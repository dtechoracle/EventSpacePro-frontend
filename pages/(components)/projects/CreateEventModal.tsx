"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { useSceneStore } from "@/store/sceneStore";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

export default function CreateEventModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState(1);
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState("");
  const [venueImage, setVenueImage] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const router = useRouter();
  const setCanvas = useSceneStore((s) => s.setCanvas);
  const { slug } = router.query;

  const mutation = useMutation<{ message: string; data: { _id: string } }, ApiError>({
    mutationKey: ["create-event"],
    mutationFn: () => {
      // Use default large canvas (10m x 10m) for flexibility
      const canvases = [{
        size: "layout",
        width: 10000,
        height: 10000
      }];

      return apiRequest(`/projects/${slug}/events`, "POST", {
        name: eventName,
        type: eventType,
        canvases
      }, true);
    },
    onSuccess: async (response) => {
      const eventId = response.data._id;

      // If preloaded venue with image, analyze it first
      if (eventType === "Preloaded venue" && venueImage) {
        setIsAnalyzing(true);
        try {
          // Upload and analyze image
          const formData = new FormData();
          formData.append('image', venueImage);
          formData.append('eventId', eventId);

          const analyzeResponse = await fetch('/api/ai/analyze-venue', {
            method: 'POST',
            body: formData,
          });

          if (!analyzeResponse.ok) {
            throw new Error('Failed to analyze venue image');
          }

          const { layout } = await analyzeResponse.json();

          // Navigate to editor with layout data
          router.push({
            pathname: `/dashboard/editor/${slug}/${eventId}`,
            query: { venueLayout: JSON.stringify(layout) }
          });
        } catch (error) {
          console.error('Venue analysis failed:', error);
          toast.error('Failed to analyze venue image. Opening blank editor.');
          router.push(`/dashboard/editor/${slug}/${eventId}`);
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        // Normal event - go straight to editor
        router.push(`/dashboard/editor/${slug}/${eventId}`);
      }

      toast.success("Event created successfully!");
      onClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Event creation failed");
      setPhase(1);
    },
  });

  const handleNext = () => {
    if (eventType === "Preloaded venue") {
      setPhase(2); // Show image upload for preloaded venue
    } else {
      // Skip to creation for other event types
      mutation.mutate();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setVenueImage(file);
    } else {
      toast.error('Please select a valid image file');
    }
  };

  const handleSubmit = () => {
    mutation.mutate();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[9999]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-[#FDFDFF] w-[35rem] min-h-[18.6rem] rounded-[2.25rem] p-[2.625rem] flex flex-col gap-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            {phase === 1 && (
              <motion.div
                key="phase1"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <h2 className="text-[2rem] font-semibold text-[#272235]">
                  Create New Event
                </h2>
                <input
                  type="text"
                  placeholder="Event Name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                />
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                >
                  <option value="" className="text-gray-500">Event Type</option>
                  <option value="Custom venue">Custom Venue</option>
                  <option value="Create marquee">Create Marquee</option>
                  <option value="Half store">Half Store</option>
                  <option value="Preloaded venue">Preloaded Venue</option>
                </select>
                <button
                  onClick={handleNext}
                  disabled={!eventName || !eventType}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50"
                >
                  {eventType === "Preloaded venue" ? "Next" : "Create Event"}
                </button>
              </motion.div>
            )}

            {phase === 2 && eventType === "Preloaded venue" && (
              <motion.div
                key="phase2"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <h2 className="text-[2rem] font-semibold text-[#272235]">
                  Upload Venue Image
                </h2>
                <p className="text-sm text-gray-600">
                  Upload an image of your venue floor plan or layout. AI will analyze it and recreate it in the editor.
                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="venue-image"
                  />
                  <label htmlFor="venue-image" className="cursor-pointer">
                    {venueImage ? (
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">{venueImage.name}</p>
                        <p className="text-xs text-gray-500">Click to change image</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Click to upload image</p>
                        <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                      </div>
                    )}
                  </label>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!venueImage || mutation.isPending || isAnalyzing}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(mutation.isPending || isAnalyzing) ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {isAnalyzing ? "Analyzing Image..." : "Creating Event..."}
                    </>
                  ) : (
                    "Create & Analyze"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

