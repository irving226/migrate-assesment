// Single source of truth for the tag taxonomy. Both the LLM prompt and the
// filter UI import from here, so the two can never drift apart.
export const TAGS = [
    "ai_ml",
    "technical_deep_dive",
    "new_tool_or_library",
    "company_or_startup_news",
    "security_privacy",
    "science_research",
    "show_hn_launch",
    "career_work_culture",
    "policy_regulation_law",
    "opinion_analysis",
  ] as const;
  
  export type Tag = (typeof TAGS)[number];
  
  // Human-readable descriptions, fed verbatim into the tagging prompt so the
  // model classifies against the same definitions a person would read in the UI.
  export const TAG_DESCRIPTIONS: Record<Tag, string> = {
    ai_ml: "LLMs, ML infrastructure, agents, model behavior, evals, inference, AI products",
    technical_deep_dive: "Detailed engineering: architecture, performance, systems, protocols, databases, compilers",
    new_tool_or_library: "A project, framework, API, library, model, or developer tool people may want to try",
    company_or_startup_news: "Fundraising, acquisition, shutdown, launch, layoffs, pricing, product/business news",
    security_privacy: "Vulnerabilities, exploits, surveillance, data leaks, privacy, cryptography, auth",
    science_research: "Academic/scientific research, papers, biology, physics, medicine, climate, space",
    show_hn_launch: "Show HN, Ask HN, Launch HN, personal project announcements",
    career_work_culture: "Hiring, interviewing, remote work, management, productivity, burnout, compensation",
    policy_regulation_law: "Government, courts, regulation, antitrust, labor, copyright, AI policy, governance",
    opinion_analysis: "Essays, arguments, hot takes, reflections, criticism, non-news analysis",
  };
  
  export type StoryType = "top" | "new" | "best" | "ask" | "show" | "job";
  
  export interface Story {
    id: number;
    title: string;
    url: string | null;
    domain: string | null;
    by: string;
    score: number;
    descendants: number;
    time: number; 
    kids?: number[];
    type: string;
    text?: string | null; 
    tags: Tag[];
  }
  
  
  export interface HNItem {
    id: number;
    deleted?: boolean;
    type?: string;
    by?: string;
    time?: number;
    text?: string;
    dead?: boolean;
    parent?: number;
    kids?: number[];
    url?: string;
    score?: number;
    title?: string;
    descendants?: number;
  }
  
  export interface Comment {
    id: number;
    by: string;
    text: string;
    time: number;
    kids?: number[];
  }