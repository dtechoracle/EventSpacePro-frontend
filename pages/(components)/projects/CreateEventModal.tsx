"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSceneStore } from "@/store/sceneStore";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

export default function CreateEventModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'initial' | 'venue-selection' | 'outdoor-selection' | 'event-details' | 'upload-image'>('initial');
  const [creationType, setCreationType] = useState<'manual' | 'ai'>('manual');
  const [venueType, setVenueType] = useState<'preloaded' | 'custom' | 'marquee' | 'outdoor'>('custom');
  const [outdoorType, setOutdoorType] = useState<'beach' | 'field' | null>(null);
  const [outdoorWidth, setOutdoorWidth] = useState(20);
  const [outdoorDepth, setOutdoorDepth] = useState(20);
  const [eventName, setEventName] = useState("");
  const [venueImage, setVenueImage] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const router = useRouter();
  const setCanvas = useSceneStore((s) => s.setCanvas);
  const { slug } = router.query;

  // Fetch projects if no slug is present
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiRequest('/projects', 'GET'),
    enabled: !slug
  });

  const [selectedProjectId, setSelectedProjectId] = useState((slug as string) || "");

  // Update selectedProjectId when projects load if not already set
  useEffect(() => {
    if (slug) {
      setSelectedProjectId(slug as string);
    } else {
      const projectsList = Array.isArray(projects) ? projects : (projects as any)?.data || [];
      if (projectsList && projectsList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectsList[0]._id);
      }
    }
  }, [slug, projects, selectedProjectId]);

  const mutation = useMutation<{ message: string; data: { _id: string } }, ApiError>({
    mutationKey: ["create-event"],
    mutationFn: () => {
      if (!selectedProjectId) {
        throw new Error("Please select a project");
      }

      // Determine canvas size
      let width = 10000;
      let height = 10000;

      if (venueType === 'outdoor') {
        width = outdoorWidth * 1000;
        height = outdoorDepth * 1000;
      }

      const canvases = [{
        size: "layout",
        width,
        height
      }];

      // Map venue type to event type
      const eventTypeMap = {
        'preloaded': 'Preloaded venue',
        'custom': 'Custom venue',
        'marquee': 'Marquee',
        'outdoor': 'Outdoor Venue'
      };

      return apiRequest(`/projects/${selectedProjectId}/events`, "POST", {
        name: eventName,
        type: eventTypeMap[venueType],
        canvases
      }, true);
    },
    onSuccess: async (response) => {
      const eventId = response.data._id;

      // If AI mode, navigate with aiMode flag
      if (creationType === 'ai') {
        router.push({
          pathname: `/dashboard/editor/${selectedProjectId}/${eventId}`,
          query: { aiMode: 'true' }
        });
        toast.success("Event created! AI assistant is ready.");
        onClose();
        return;
      }

      // If preloaded venue with image, analyze it first
      if (venueType === 'preloaded' && venueImage) {
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
            pathname: `/dashboard/editor/${selectedProjectId}/${eventId}`,
            query: { venueLayout: JSON.stringify(layout) }
          });
        } catch (error) {
          console.error('Venue analysis failed:', error);
          toast.error('Failed to analyze venue image. Opening blank editor.');
          router.push(`/dashboard/editor/${selectedProjectId}/${eventId}`);
        } finally {
          setIsAnalyzing(false);
        }
      } else {
        // Normal event - go straight to editor
        const query: any = {};
        if (venueType === 'outdoor' && outdoorType) {
          query.texture = outdoorType === 'beach' ? 'sand' : 'grass';
        }

        router.push({
          pathname: `/dashboard/editor/${selectedProjectId}/${eventId}`,
          query
        });
      }

      toast.success("Event created successfully!");
      onClose();
    },
    onError: (err: ApiError) => {
      toast.error(err.message || "Event creation failed");
      setStep('event-details');
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setVenueImage(file);
    } else {
      toast.error('Please select a valid image or PDF file');
    }
  };

  const handleCreateEvent = () => {
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
            {/* Step 1: Initial Choice - Create Event or Create with AI */}
            {step === 'initial' && (
              <motion.div
                key="initial"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <h2 className="text-[2rem] font-semibold text-[#272235]">
                  Create New Event
                </h2>
                <p className="text-sm text-gray-600">
                  Choose how you'd like to create your event
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setCreationType('manual');
                      setStep('venue-selection');
                    }}
                    className="w-full h-14 rounded-2xl text-[#272235] text-base font-medium bg-[#0000000A] hover:bg-[#0000001A] transition-colors"
                  >
                    Create Event
                  </button>
                  <button
                    onClick={() => {
                      setCreationType('ai');
                      setStep('event-details');
                    }}
                    className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] hover:opacity-90 transition-opacity"
                  >
                    Create Event with AI
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Venue Selection Cards (only for manual creation) */}
            {step === 'venue-selection' && (
              <motion.div
                key="venue-selection"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <button
                    onClick={() => setStep('initial')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Select Venue Type
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Custom Venue Card - PRIORITY 1 */}
                  <button
                    onClick={() => {
                      setVenueType('custom');
                      setStep('event-details');
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base">Custom Venue</h3>
                      <p className="text-xs text-gray-500 mt-1">Start from scratch</p>
                    </div>
                  </button>

                  {/* Outdoor Venue Card */}
                  <button
                    onClick={() => {
                      setVenueType('outdoor');
                      setStep('outdoor-selection');
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base">Outdoor Venue</h3>
                      <p className="text-xs text-gray-500 mt-1">Open-air space</p>
                    </div>
                  </button>

                  {/* Marquee Card */}
                  <button
                    onClick={() => {
                      setVenueType('marquee');
                      setStep('event-details');
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base">Marquee</h3>
                      <p className="text-xs text-gray-500 mt-1">Tent/canopy event</p>
                    </div>
                  </button>

                  {/* Preloaded Venue Card */}
                  <button
                    onClick={() => {
                      setVenueType('preloaded');
                      setStep('event-details');
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base">Preloaded Venue</h3>
                      <p className="text-xs text-gray-500 mt-1">Upload image/PDF</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2.5: Outdoor Selection (Beach vs Field) */}
            {step === 'outdoor-selection' && (
              <motion.div
                key="outdoor-selection"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <button
                    onClick={() => setStep('venue-selection')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Select Environment
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Field Option */}
                  <button
                    onClick={() => {
                      setOutdoorType('field');
                      setStep('event-details');
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
                      🌿
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base">Field / Grass</h3>
                      <p className="text-xs text-gray-500 mt-1">Green open space</p>
                    </div>
                  </button>

                  {/* Beach Option */}
                  <button
                    onClick={() => {
                      setOutdoorType('beach');
                      setStep('event-details');
                    }}
                    className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-3xl">
                      🏖️
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-base">Beach / Sand</h3>
                      <p className="text-xs text-gray-500 mt-1">Sandy environment</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Event Details */}
            {step === 'event-details' && (
              <motion.div
                key="event-details"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <button
                    onClick={() => setStep(creationType === 'ai' ? 'initial' : 'venue-selection')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Event Details
                  </h2>
                </div>

                {/* Project Selection (if no slug) */}
                {!slug && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full h-14 rounded-2xl px-6 bg-[#0000000A] text-base outline-none appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Select a project</option>
                      {(Array.isArray(projects) ? projects : (projects as any)?.data || []).map((p: any) => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Event Name"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full h-14 rounded-2xl px-6 py-4 bg-[#0000000A] text-base outline-none"
                  autoFocus
                />

                {venueType === 'outdoor' && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 ml-1">Width (m)</label>
                      <input
                        type="number"
                        min="1"
                        value={outdoorWidth}
                        onChange={(e) => setOutdoorWidth(Number(e.target.value))}
                        className="w-full h-14 rounded-2xl px-6 bg-[#0000000A] text-base outline-none mt-1"
                        placeholder="20"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700 ml-1">Length (m)</label>
                      <input
                        type="number"
                        min="1"
                        value={outdoorDepth}
                        onChange={(e) => setOutdoorDepth(Number(e.target.value))}
                        className="w-full h-14 rounded-2xl px-6 bg-[#0000000A] text-base outline-none mt-1"
                        placeholder="20"
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (venueType === 'preloaded' && creationType === 'manual') {
                      setStep('upload-image');
                    } else {
                      handleCreateEvent();
                    }
                  }}
                  disabled={!eventName || (venueType === 'outdoor' && (!outdoorWidth || !outdoorDepth))}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50"
                >
                  {venueType === 'preloaded' && creationType === 'manual' ? 'Next' : 'Create Event'}
                </button>
              </motion.div>
            )}

            {/* Step 4: Upload Image (only for preloaded venue) */}
            {step === 'upload-image' && (
              <motion.div
                key="upload-image"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <button
                    onClick={() => setStep('event-details')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Upload Venue Image
                  </h2>
                </div>

                <p className="text-sm text-gray-600">
                  Upload an image or PDF of your venue floor plan. AI will analyze it and recreate it in the editor.
                </p>

                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
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
                        <p className="text-xs text-gray-500">Click to change file</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Click to upload</p>
                        <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
                      </div>
                    )}
                  </label>
                </div>

                <button
                  onClick={handleCreateEvent}
                  disabled={!venueImage || mutation.isPending || isAnalyzing}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(mutation.isPending || isAnalyzing) ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {isAnalyzing ? "Analyzing..." : "Creating..."}
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
