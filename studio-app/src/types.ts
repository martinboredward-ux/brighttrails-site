export type Mode = "activity" | "storybook" | "nonfiction";
export type JobStatus = "idle" | "running" | "done" | "error";

export interface Section { id: string; title: string; summary: string; draft: string }
export interface APlusModule {
  size: "970x600" | "970x300" | "300x300";
  headline: string;
  body: string;
  imageId?: string;
  fit?: "fit" | "fill";
  textBar?: boolean;
}
export interface KdpPackage {
  titleIdeas: string[];
  htmlDescription: string;
  keywords: string[];
  categories: string[];
  isLowContent: boolean;
  aPlusModules: APlusModule[];
  warnings?: string[];
}
export type RefKind = "character" | "badge" | "prop" | "cover" | "page";
export interface CharacterRef { id: string; name: string; kind: RefKind }
export interface Book {
  id: string; slug: string; title: string; subtitle: string; mode: Mode; audience: string;
  seriesName: string; linkedBookIds: string[];
  trim: "8.5x11" | "6x9"; aiDisclosure: "none" | "assisted" | "generated";
  notes: string; styleBible: string; sections: Section[]; review: string; workbook: string;
  kdp: KdpPackage | null;
  images: GeneratedImage[];
  characterRefId: string;
  /** Character Library: named reference pictures (characters, badges, props) used by every image engine. */
  characters: CharacterRef[];
  research: string;
  preReview: string;
  reviewQuestion: string;
  reviewDirection: string;
  polishDirection: string;
  previousNotesBackup: string | null;
  previousStyleBibleBackup: string | null;
  previousSectionsBackup: Section[] | null;
  nameplateLabel: string;
  cover: CoverSettings;
  rescueAudit: string;
  jobStatus: JobStatus; jobAction: string; jobError: string; jobUpdatedAt: string;
  createdAt: string; updatedAt: string;
}
export type ImageProvider = "openai-mini" | "openai-1.5" | "nano-banana";
export type ImageAspect = "portrait" | "square" | "landscape";
export type StylePreset = "coloring" | "storybook" | "cover" | "aplus" | "library_bw" | "library_color";
export interface GeneratedImage {
  id: string; sectionId?: string; prompt: string; provider: ImageProvider; modelUsed: string;
  aspect: ImageAspect; stylePreset: StylePreset; quality: "low" | "medium"; createdAt: string;
}
export type Action = "generate_outline" | "draft_section" | "draft_all" | "review_book" | "extract_workbook" | "market_research" | "pre_review" | "apply_review" | "apply_polish";
export interface CoverSettings {
  title?: string; subtitle?: string; author?: string; seriesPill?: string;
  pageCount?: number; trim?: "6x9" | "8.5x11"; paper?: "white" | "cream" | "color";
  frontArtId?: string; backBlurb?: string; barcodeCorner?: boolean;
}
