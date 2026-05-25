import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaLink, FaUserPlus, FaChevronDown, FaSpinner, FaTimes } from "react-icons/fa";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useUserStore } from "@/store/userStore";
import { apiRequest } from "@/helpers/Config";
import { useProjectStore } from "@/store/projectStore";

interface ProjectCollaborator {
  email: string;
  role: string;
  status?: string;
  isPending?: boolean;
  name?: string;
  avatar?: string;
}

export default function ShareModal({ onClose, slug: propSlug }: { onClose: () => void; slug?: string }) {
  const user = useUserStore((s) => s.user);
  const { projectName } = useProjectStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [isInviting, setIsInviting] = useState(false);
  const [roleUpdatingEmail, setRoleUpdatingEmail] = useState<string | null>(null);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);

  // Fallback to router slug if not provided via props
  const slug = propSlug;

  // Fetch project data to get collaborators and invites
  const { data: projectData, isLoading: isLoadingProject, refetch: refetchProject } = useQuery({
    queryKey: ["project-collaborators", slug],
    queryFn: async () => {
      if (!slug) return null;
      try {
        // First try to get single project, fallback to list if needed
        const res = await apiRequest(`/projects/${slug}`, "GET", null, true).catch(async () => {
          const allRes = await apiRequest("/projects", "GET", null, true);
          return allRes.data.find((p: any) => p.slug === slug);
        });
        return res.data || res;
      } catch (err) {
        console.error("Failed to fetch project for collaborators:", err);
        return null;
      }
    },
    enabled: !!slug,
  });

  const handleInvite = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!slug) {
      toast.error("Project slug not found");
      return;
    }

    setIsInviting(true);
    try {
      await apiRequest(`/projects/${slug}/users`, "POST", {
        users: [
          {
            email,
            role: role as any,
          },
        ],
      }, true);
      
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      refetchProject(); // Refresh the list
    } catch (error: any) {
      console.error("Failed to add collaborator:", error);
      toast.error(error.message || "Failed to add user to project");
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (inviteEmail: string) => {
    if (!slug) return;
    setRemovingEmail(inviteEmail);
    try {
      await apiRequest(`/projects/${slug}/users`, "DELETE", { email: inviteEmail }, true);
      toast.success(`Invitation for ${inviteEmail} cancelled`);
      refetchProject();
    } catch (err: any) {
      console.error("Failed to cancel invitation:", err);
      toast.error(err.message || "Failed to cancel invitation");
    } finally {
      setRemovingEmail(null);
    }
  };

  const handleUpdateRole = async (targetEmail: string, nextRole: string) => {
    if (!slug) return;
    setRoleUpdatingEmail(targetEmail);
    try {
      await apiRequest(`/projects/${slug}/users/role`, "PUT", {
        email: targetEmail,
        role: nextRole,
      }, true);
      toast.success(`Updated ${targetEmail} to ${nextRole}`);
      refetchProject();
    } catch (err: any) {
      console.error("Failed to update collaborator role:", err);
      toast.error(err.message || "Failed to update collaborator role");
    } finally {
      setRoleUpdatingEmail(null);
    }
  };

  const collaborators = useMemo(() => {
    if (!projectData) return [];

    const activeUsers = (projectData.users || []).map((u: any) => ({
      email: u.email,
      role: u.role,
      isPending: false
    }));

    const pendingInvites = (projectData.invites || []).map((i: any) => ({
      email: i.email,
      role: i.role,
      isPending: true,
      status: i.status
    }));

    // Filter out the current user and duplicates
    const all = [...activeUsers, ...pendingInvites].filter(
      (c) => c.email !== user?.email
    );

    return all;
  }, [projectData, user?.email]);

  const getAvatarColor = (name: string) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
    const index = (name.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
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
          className="bg-white w-[32rem] rounded-[2.25rem] p-6 flex flex-col gap-6 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[#272235]">Share {projectName || 'Event'}</h2>
              <p className="text-xs text-gray-400 font-medium">Invite collaborators to this {projectName ? 'project' : 'event'}</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 rounded-xl transition-all"
              onClick={copyLink}
            >
              <FaLink size={14} />
              <span className="text-sm font-semibold">Copy link</span>
            </motion.button>
          </div>

          {/* Invite Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="email"
                  placeholder="Enter collaborator's email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-14 rounded-2xl px-5 bg-[#0000000A] text-base outline-none focus:ring-2 ring-[var(--accent)]/20 transition-all font-medium text-[#272235]"
                />
              </div>
              <div className="relative group">
                <select 
                  className="h-14 rounded-2xl pl-5 pr-10 bg-[#0000000A] text-base outline-none border-none cursor-pointer appearance-none font-bold text-[#272235] hover:bg-[#00000014] transition-all"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="owner">Owner</option>
                </select>
                <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-600 transition-all" size={12} />
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.01, translateY: -1 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleInvite}
              disabled={isInviting || !email}
              className={`h-14 w-full py-2 rounded-2xl text-base font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                isInviting || !email 
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none" 
                  : "bg-[var(--accent)] text-white shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/30"
              }`}
            >
              {isInviting ? (
                <FaSpinner className="animate-spin" size={18} />
              ) : (
                <FaUserPlus size={18} />
              )}
              <span>{isInviting ? "Sending..." : "Invite Collaborator"}</span>
            </motion.button>
          </div>

          {/* People with access */}
          <div className="mt-2 pt-6 border-t border-gray-100 flex-1 overflow-y-auto max-h-[16rem] custom-scrollbar pr-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">People with access</h3>
            <div className="flex flex-col gap-5">
               {/* Current User */}
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md overflow-hidden ${!user?.avatar ? 'bg-[#272235]' : ''}`}>
                            {user?.avatar ? (
                                <img 
                                    src={user?.avatar} 
                                    alt="User Avatar" 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span>{user?.firstName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'Y'}</span>
                            )}
                        </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-bold text-[#272235]">
                        {user ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user.email : 'You'} (You)
                      </p>
                      <p className="text-[0.7rem] text-gray-400 font-medium">{user?.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1.5 rounded-lg uppercase tracking-wider">Owner</span>
               </div>

               {/* Other Collaborators */}
               {isLoadingProject ? (
                 <div className="flex items-center justify-center py-4">
                   <FaSpinner className="animate-spin text-gray-300" size={20} />
                 </div>
               ) : (
                 collaborators.map((collab, idx) => (
                   <motion.div 
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.05 }}
                     key={collab.email} 
                     className="flex items-center justify-between"
                   >
                     <div className="flex items-center gap-4">
                       <div 
                         className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm"
                         style={{ backgroundColor: getAvatarColor(collab.email) }}
                       >
                         {collab.email.charAt(0).toUpperCase()}
                       </div>
                       <div className="flex flex-col">
                         <p className="text-sm font-bold text-[#272235] truncate max-w-[12rem]">
                           {collab.email.split('@')[0]}
                         </p>
                         <p className="text-[0.7rem] text-gray-400 font-medium truncate max-w-[12rem]">{collab.email}</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-2">
                       {collab.isPending ? (
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 uppercase tracking-wider shadow-sm">Pending</span>
                           <button 
                              onClick={() => handleCancelInvite(collab.email)}
                              disabled={removingEmail === collab.email}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Cancel Invitation"
                            >
                              {removingEmail === collab.email ? (
                                <FaSpinner className="animate-spin" size={12} />
                              ) : (
                                <FaTimes size={12} />
                              )}
                            </button>
                         </div>
                       ) : (
                         <div className="relative group">
                           <select
                             value={collab.role}
                             disabled={roleUpdatingEmail === collab.email}
                             onChange={(e) => handleUpdateRole(collab.email, e.target.value)}
                             className="h-8 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-[10px] font-bold uppercase tracking-wider text-gray-500 outline-none transition-all hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                           >
                             <option value="viewer">Viewer</option>
                             <option value="editor">Editor</option>
                             <option value="owner">Owner</option>
                           </select>
                           <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
                         </div>
                       )}
                     </div>
                   </motion.div>
                 ))
               )}

               {collaborators.length === 0 && !isLoadingProject && (
                 <p className="text-center text-xs text-gray-400 italic py-2">No other collaborators yet</p>
               )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


