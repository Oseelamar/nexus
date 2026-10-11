// Site data that must come from NEXUS itself. Nothing here is invented: lists stay
// empty and URLs stay blank until real information exists, and the page renders
// designed empty states / omits the matching calls to action in the meantime.

export interface Publication {
  title: string;
  /** Verified external destination (paper, preprint, repository…). */
  url?: string;
  authors?: string[];
  /** ISO date, e.g. "2026-03-14". */
  date?: string;
  /** e.g. "Paper", "Preprint", "Technical report", "Dataset". */
  type?: string;
  summary?: string;
}

/** Published research outputs, newest first. */
export const PUBLICATIONS: Publication[] = [];

/** Destination for “Explore publications ↗” (e.g. an external index). Blank hides the link. */
export const PUBLICATIONS_URL = '';

/**
 * Contact destination for “Discuss research ↗” and the careers pathway, e.g.
 * "mailto:…" or a form URL. Blank hides those two links; the rest of the page
 * routes “Get in touch” to the #connect section, which always exists.
 */
export const CONTACT_URL = '';
