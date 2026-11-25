export type Mode = "activity" | "storybook" | "nonfiction";
export type JobStatus = "idle" | "running" | "done" | "error";

export interface Section { id: string; title: string; summary: string; draft: string }
export interface APlusModule { size: "970x600" | "970x300" | "300x300"; headline: string; body: string }
export interface KdpPackage {
  titleIdeas: string[];
  htmlDescription: string;
  keywords: string[];
  categories: string[];
  isLowContent: boolean;
  aPlusModules: APlusModule[];
  warnings?: string[];
}
export interface Book {
  id: string; slug: string; title: string; subtitle: string; mode: Mode; audience: string;
  trim: "8.5x11" | "6x9"; aiDisclosure: "none" | "assisted" | "generated";
  notes: string; styleBible: string; sections: Section[]; review: string; workbook: string;
  kdp: KdpPackage | null;
  jobStatus: JobStatus; jobAction: string; jobError: string; jobUpdatedAt: string;
  createdAt: string; updatedAt: string;
}
export type Action = "generate_outline" | "draft_section" | "review_book" | "extract_workbook";
