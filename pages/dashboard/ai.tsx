"use client";
import React, { useState, useRef, useEffect } from "react";
import DashboardSidebar from "@/pages/(components)/DashboardSidebar";
import CreateEventModal from "@/pages/(components)/projects/CreateEventModal";
import { BsStars, BsSend, BsRobot, BsPerson } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import { convertPlanToCanvasData } from "@/helpers/aiHelper";
import toast from "react-hot-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  plan?: any;
  canvasData?: any;
}

const AiAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your AI event planner. detailed Describe the event you want to create (e.g., 'A wedding reception with 10 round tables and a head table'), and I'll generate a layout for you." }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplateData, setSelectedTemplateData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    setInputValue("");
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.concat({ role: 'user', content: userMsg }).map(m => ({ role: m.role, content: m.content })),
          canvas: { width: 10000, height: 10000 } // Assume standard large canvas
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");

      const data = await res.json();

      if (data.plan) {
        // Convert plan to canvas data immediately
        const canvasData = convertPlanToCanvasData(data.plan);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || "I've generated a layout plan for you. Would you like to create an event with this layout?",
          plan: data.plan,
          canvasData
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message || "I'm not sure how to help with that yet, but I'm learning!" }]);
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to get response from AI");
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error while processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = (canvasData: any) => {
    setSelectedTemplateData(canvasData);
    setShowCreateModal(true);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-gray-300/50 px-8 py-5 shadow-sm z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--accent)] flex items-center gap-2">
                <BsStars /> AI Assistant
              </h1>
              <p className="text-sm text-gray-500 mt-1">Design your event space with natural language</p>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <BsRobot className="text-blue-600" />
                  </div>
                )}

                <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.role === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                  }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                  {msg.canvasData && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <BsStars className="text-yellow-500" /> Plan Generated
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          Includes {msg.canvasData.assets.length} items (tables, chairs, walls).
                        </p>
                        <button
                          onClick={() => handleCreateEvent(msg.canvasData)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          View & Create Event
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <BsPerson className="text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <BsRobot className="text-blue-600" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-none p-4 shadow-sm border border-gray-100">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe your event layout..."
              className="w-full pl-6 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:bg-white transition-all shadow-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <BsSend className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Create Event Modal */}
        {showCreateModal && (
          <CreateEventModal
            onClose={() => setShowCreateModal(false)}
            initialTemplateData={selectedTemplateData}
          />
        )}
      </div>
    </div>
  );
};

export default AiAssistant;
