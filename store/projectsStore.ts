// stores/projectsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Event = {
  id: string;
  name: string;
  paperSize: string;
  createdAt: string;
  lastEdited: string;
};

export type Project = {
  id: string;
  name: string;
  collaborators: string[];
  events: Event[];
  createdAt: string;
  lastEdited: string;
};

type ProjectsState = {
  projects: Project[];

  // Project actions
  addProject: (name: string, collaborators?: string[]) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Event actions
  addEvent: (projectId: string, name: string, paperSize: string) => Event;
  updateEvent: (projectId: string, eventId: string, updates: Partial<Event>) => void;
  deleteEvent: (projectId: string, eventId: string) => void;
};

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: [],

      // PROJECTS ------------------------
      addProject: (name, collaborators = []) => {
        const id = Date.now().toString();
        const project: Project = {
          id,
          name,
          collaborators,
          events: [],
          createdAt: new Date().toISOString(),
          lastEdited: new Date().toISOString(),
        };

        set((state) => ({
          projects: [...state.projects, project],
        }));

        return project;
      },

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, lastEdited: new Date().toISOString() } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),

      // EVENTS --------------------------
      addEvent: (projectId, name, paperSize) => {
        const eventId = Date.now().toString();
        const event: Event = {
          id: eventId,
          name,
          paperSize,
          createdAt: new Date().toISOString(),
          lastEdited: new Date().toISOString(),
        };

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, events: [...p.events, event], lastEdited: new Date().toISOString() }
              : p
          ),
        }));

        return event;
      },

      updateEvent: (projectId, eventId, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  events: p.events.map((e) =>
                    e.id === eventId
                      ? { ...e, ...updates, lastEdited: new Date().toISOString() }
                      : e
                  ),
                  lastEdited: new Date().toISOString(),
                }
              : p
          ),
        })),

      deleteEvent: (projectId, eventId) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, events: p.events.filter((e) => e.id !== eventId) }
              : p
          ),
        })),
    }),
    {
      name: "projects-storage", // for local persistence
    }
  )
);

