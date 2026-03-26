"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useSceneStore } from "@/store/sceneStore";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/helpers/Config";
import toast from "react-hot-toast";
import { MARQUEES } from "@/lib/marquees";
import InlineSvg from "@/components/tools/InlineSvg";
import { FaUserPlus, FaChevronDown, FaPlus } from "react-icons/fa";

interface ApiError {
  message: string;
  errors?: { path: string; message: string; code: string }[];
}

export default function CreateEventModal({ onClose, initialTemplateData }: { onClose: () => void, initialTemplateData?: any }) {
  const [step, setStep] = useState<'initial' | 'venue-selection' | 'outdoor-selection' | 'outdoor-dimensions' | 'marquee-selection' | 'event-details' | 'upload-image'>('initial');

  useEffect(() => {
    if (initialTemplateData) {
      setStep('event-details');
    }
  }, [initialTemplateData]);

  const [creationType, setCreationType] = useState<'manual' | 'ai'>('manual');
  const [venueType, setVenueType] = useState<'preloaded' | 'custom' | 'marquee' | 'outdoor'>('custom');
  const [outdoorType, setOutdoorType] = useState<'beach' | 'field' | 'parking-lot' | null>(null);
  const [outdoorWidth, setOutdoorWidth] = useState(20);
  const [outdoorDepth, setOutdoorDepth] = useState(20);
  const [eventName, setEventName] = useState("");
  const [selectedMarquee, setSelectedMarquee] = useState<any>(null);
  const [venueImage, setVenueImage] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [collabEmail, setCollabEmail] = useState("");
  const [collabPermission, setCollabPermission] = useState("editor");
  const router = useRouter();
  const setCanvas = useSceneStore((s) => s.setCanvas);
  const lastCanvasDataRef = useRef<any>(null);
  const lastCanvasesRef = useRef<any>(null);
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
    const initProject = async () => {
      if (slug) {
        setSelectedProjectId(slug as string);
        return;
      }
      
      // If no slug (dashboard mode), find or create "Personal Drafts"
      if (projects) {
        const list = Array.isArray(projects) ? projects : (projects as any)?.data || [];
        const HIDDEN_PROJECT_NAME = "Personal Drafts";
        let target = list.find((p: any) => p.name === HIDDEN_PROJECT_NAME);
        
        if (target) {
          setSelectedProjectId(target.slug);
        } else {
          try {
            const res = await apiRequest("/projects", "POST", { name: HIDDEN_PROJECT_NAME }, true);
            setSelectedProjectId(res.data.slug);
          } catch (e) {
            console.error("Failed to create default project", e);
          }
        }
      }
    };
    
    initProject();
  }, [slug, projects]);

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

      // Determine canvas data (assets, shapes, etc)
      let canvasData = undefined;
      
      if (venueType === 'outdoor') {
        const textureId = outdoorType === 'beach' ? 'sand-01' : (outdoorType === 'parking-lot' ? 'parking-lot' : 'grass-01');
        const backgroundName = outdoorType === 'beach' ? 'Beach Layout' : (outdoorType === 'parking-lot' ? 'Parking Lot' : 'Grass Layout');
        canvasData = {
          walls: [],
          assets: [],
          shapes: [
            {
              id: "background-texture",
              name: backgroundName,
              type: "rectangle",
              x: width / 2,
              y: height / 2,
              width: width,
              height: height,
              fill: `url(#${textureId})`,
              fillType: 'texture',
              fillTexture: textureId,
              stroke: "none",
              strokeWidth: 0,
              rotation: 0,
              zIndex: -100,
              points: []
            }
          ],
          canvas: { width, height, color: '#ffffff' }
        };
      } else if (venueType === 'marquee' && selectedMarquee) {
        // Set canvas to be slightly larger than the marquee
        width = selectedMarquee.width + 4000;
        height = selectedMarquee.height + 4000;
        canvases[0].width = width;
        canvases[0].height = height;

        canvasData = {
          walls: [],
          shapes: [],
          assets: [
            {
              id: `marquee-${Date.now()}`,
              name: 'Marquee',
              type: selectedMarquee.id,
              x: width / 2,
              y: height / 2,
              width: selectedMarquee.width,
              height: selectedMarquee.height,
              scale: 1,
              rotation: 0,
              zIndex: 1,
              fillColor: "none",
              strokeColor: "#000000",
              strokeWidth: 0.5
            }
          ],
          canvas: { width, height, color: '#ffffff' }
        };
      }

      lastCanvasDataRef.current = canvasData;
      lastCanvasesRef.current = canvases;

      return apiRequest(`/projects/${selectedProjectId}/events`, "POST", {
        name: eventName,
        type: eventTypeMap[venueType],
        canvases,
        canvasData
      }, true);
    },
    onSuccess: async (response) => {
      const eventId = response.data._id;

      // Send collaborator invitation if email is provided
      if (collabEmail && collabEmail.includes("@")) {
        try {
          await apiRequest(`/projects/${selectedProjectId}/invites`, "POST", {
            email: collabEmail,
            role: collabPermission
          }, true);
          toast.success(`Invitation sent to ${collabEmail}`);
        } catch (e) {
          console.error("Failed to send collaborator invitation", e);
          toast.error("Event created but failed to send invitation");
        }
      }

      // Handle Template or Marquee Data Injection
      if (initialTemplateData || (venueType === 'marquee' && selectedMarquee)) {
        try {
          const dataToApply = initialTemplateData || lastCanvasDataRef.current;
          await apiRequest(`/projects/${selectedProjectId}/events/${eventId}`, "PUT", {
            canvasData: dataToApply,
            canvases: lastCanvasesRef.current // Ensure canvas dimensions are sync'd
          }, true);
        } catch (e) {
          console.error("Failed to apply marquee/template data", e);
          toast.error("Created event but failed to apply initial layout");
        }
      }

      // If AI mode, navigate with aiMode flag
      if (creationType === 'ai') {
        router.push({
          pathname: `/dashboard/editor/${selectedProjectId}/${eventId}`,
          query: { 
            aiMode: 'true',
            marqueeId: venueType === 'marquee' ? selectedMarquee?.id : undefined,
            focus: 'true'
          }
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
        const query: any = { focus: 'true' };
        if (venueType === 'outdoor' && outdoorType) {
          query.texture = outdoorType === 'beach' ? 'sand-01' : (outdoorType === 'parking-lot' ? 'parking-lot' : 'grass-01');
        }

        if (venueType === 'marquee' && selectedMarquee) {
          query.marqueeId = selectedMarquee.id;
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
          className="bg-[#FDFDFF] text-[#272235] w-[35rem] min-h-[18.6rem] rounded-[2.25rem] p-[2.625rem] flex flex-col gap-6 relative"
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

                <div className="text-center mt-2 pb-2">
                  <button 
                    onClick={() => {
                      router.push('/dashboard/projects');
                      onClose();
                    }}
                    className="text-xs text-gray-400 hover:text-[var(--accent)] font-medium transition-all group inline-flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <span>Create a project instead?</span>
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
                      setStep('marquee-selection');
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

                <div className="grid grid-cols-3 gap-3">
                  {/* Field Option */}
                  <button
                    onClick={() => {
                      setOutdoorType('field');
                      setStep('outdoor-dimensions');
                    }}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                      🌿
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-xs whitespace-nowrap">Grass Area</h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">Field / Grass</p>
                    </div>
                  </button>



                  {/* Beach Option */}
                  <button
                    onClick={() => {
                      setOutdoorType('beach');
                      setStep('outdoor-dimensions');
                    }}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">
                      🏖️
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-[13px]">Beach / Sand</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Sand area</p>
                    </div>
                  </button>


                  {/* Parking Lot Option */}
                  <button
                    onClick={() => {
                      setOutdoorType('parking-lot');
                      setStep('outdoor-dimensions');
                    }}
                    className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-gray-200 hover:border-[var(--accent)] hover:bg-[#0000000A] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">
                      🚗
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-[13px]">Paved Area</h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Landscaped Paving</p>
                    </div>
                  </button>

                </div>
              </motion.div>
            )}

            {/* Step 2.6: Outdoor Dimensions */}
            {step === 'outdoor-dimensions' && (
              <motion.div
                key="outdoor-dimensions"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6"
              >
                <div>
                  <button
                    onClick={() => setStep('outdoor-selection')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Set Area Dimensions
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Enter the size of your {outdoorType === 'beach' ? 'beach' : 'field'} space
                  </p>
                </div>

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
                      autoFocus
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

                <button
                  onClick={() => setStep('event-details')}
                  disabled={!outdoorWidth || !outdoorDepth || outdoorWidth <= 0 || outdoorDepth <= 0}
                  className="w-full h-14 rounded-2xl text-white text-base font-medium bg-[var(--accent)] disabled:opacity-50"
                >
                  Confirm Dimensions
                </button>
              </motion.div>
            )}

            {/* Step 2.7: Marquee Selection */}
            {step === 'marquee-selection' && (
              <motion.div
                key="marquee-selection"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-6 w-full max-h-[70vh]"
              >
                <div>
                  <button
                    onClick={() => setStep('venue-selection')}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Select Marquee
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose a marquee template to start with
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                  {MARQUEES.map((marquee) => (
                    <button
                      key={marquee.id}
                      onClick={() => {
                        setSelectedMarquee(marquee);
                        setStep('event-details');
                      }}
                      className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all hover:bg-[#00000005] group ${
                        selectedMarquee?.id === marquee.id ? 'border-[var(--accent)] bg-[#0000000A]' : 'border-gray-100'
                      }`}
                    >
                      <div className="w-full aspect-video bg-white rounded-xl border border-gray-100 overflow-hidden flex items-center justify-center p-4 group-hover:shadow-sm transition-all">
                        <InlineSvg 
                            src={marquee.path} 
                            stroke="#272235"
                            strokeWidth={2}
                            fill="none"
                        />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-sm truncate w-full">{marquee.name}</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">{marquee.width/1000}m x {marquee.height/1000}m</p>
                      </div>
                    </button>
                  ))}
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
                    onClick={() => {
                        if (creationType === 'ai') setStep('initial');
                        else if (venueType === 'outdoor') setStep('outdoor-dimensions');
                        else if (venueType === 'marquee') setStep('marquee-selection');
                        else setStep('venue-selection');
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 mb-2"
                  >
                    ← Back
                  </button>
                  <h2 className="text-[2rem] font-semibold text-[#272235]">
                    Event Details
                  </h2>
                </div>

                {/* Project Selection (only if inside a specific project already or if we want to change it) */}
                {slug && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="w-full h-14 rounded-2xl px-6 bg-[#0000000A] text-base outline-none appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Select a project</option>
                      {(Array.isArray(projects) ? projects : (projects as any)?.data || []).map((p: any) => (
                        <option key={p._id} value={p.slug}>{p.name}</option>
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

                <div className="flex flex-col gap-3 mt-2">
                  <h3 className="text-sm font-bold text-[#272235] px-1">Invite Collaborators (Optional)</h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="email"
                        placeholder="Enter collaborator's email"
                        value={collabEmail}
                        onChange={(e) => setCollabEmail(e.target.value)}
                        className="w-full h-14 rounded-2xl px-6 bg-[#0000000A] text-base outline-none focus:ring-2 ring-[var(--accent)]/10 transition-all font-medium text-[#272235]"
                      />
                    </div>
                    <div className="relative group">
                      <select 
                        value={collabPermission}
                        onChange={(e) => setCollabPermission(e.target.value)}
                        className="h-14 rounded-2xl pl-5 pr-10 bg-[#0000000A] text-sm outline-none border-none cursor-pointer appearance-none font-bold text-[#272235] hover:bg-[#00000014] transition-all"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                      </select>
                      <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-600 transition-all" size={12} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 px-1">Collaborators will be added to the {slug || 'current'} project</p>
                </div>

                <div className="flex justify-center -mb-2">
                  <button 
                    onClick={() => router.push("/dashboard/projects")}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Create a new project instead?
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (venueType === 'preloaded' && creationType === 'manual') {
                      setStep('upload-image');
                    } else {
                      handleCreateEvent();
                    }
                  }}
                  disabled={!eventName || !selectedProjectId || mutation.isPending || (venueType === 'outdoor' && (!outdoorWidth || !outdoorDepth))}
                  className="w-full h-14 rounded-2xl text-white text-base font-bold bg-[var(--accent)] disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-100 shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/30 transition-all flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <FaPlus className="text-white" />
                    </motion.div>
                  ) : (
                    <FaPlus size={18} />
                  )}
                  <span>{mutation.isPending ? 'Creating...' : venueType === 'preloaded' && creationType === 'manual' ? 'Next' : 'Create Event'}</span>
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
