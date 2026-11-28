export type Mode = "activity" | "storybook" | "nonfiction";
export type JobStatus = "idle" | "running" | "done" | "error";

import type { Trim } from "./utils/trims";
export type WidgetKind = "wordbank" | "compass" | "mapgrid" | "steps" | "dots" | "tracing" | "dotmarker";
export interface Section { id: string; title: string; summary: string; draft: string; /** "coloring": a picture-only page with no text (a blank back is added). */ kind?: "coloring"; widget?: WidgetKind; rank?: 0 | 1 | 2 | 3 }
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
export type RefKind = "character" | "badge" | "prop" | "cover" | "page" | "puzzle";
export interface CharacterRef { id: string; name: string; kind: RefKind }
export interface Book {
  id: string; slug: string; title: string; subtitle: string; mode: Mode; audience: string;
  seriesName: string; linkedBookIds: string[];
  trim: Trim; aiDisclosure: "none" | "assisted" | "generated";
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
  /** Review #1 (idea, market, age fit) and Review #2 (proofread QA): structured fixes, picked ids and the last change log. */
  preReviewFixes: ReviewFix[];
  preReviewSelected: string[];
  reviewFixes: ReviewFix[];
  reviewSelected: string[];
  lastApplied: AppliedLog | null;
  approvedAt: string;
  /** idea, writing, art, interior, cover, proof, published. */
  stage: string;
  ignoredAssetNames: string[];
  /** Library item of type Prop stamped in the corner of printable pages (for example a Compass Rose). */
  cornerPropId: string;
  jobStatus: JobStatus; jobAction: string; jobError: string; jobUpdatedAt: string;
  createdAt: string; updatedAt: string;
}
export type ImageProvider = "openai-mini" | "openai-1.5" | "nano-banana" | "upload";
export type ImageAspect = "portrait" | "square" | "landscape";
export type StylePreset = "coloring" | "storybook" | "cover" | "aplus" | "library_bw" | "library_color";
export interface GeneratedImage {
  id: string; sectionId?: string; prompt: string; provider: ImageProvider; modelUsed: string;
  aspect: ImageAspect; stylePreset: StylePreset; quality: "low" | "medium"; createdAt: string;
  /** "puzzle": fills the worksheet box instead of being the page picture. */
  slot?: "puzzle";
}
export type Action = "generate_outline" | "draft_section" | "draft_all" | "review_book" | "extract_workbook" | "market_research" | "pre_review" | "apply_review" | "apply_polish";
export interface CoverSettings {
  title?: string; subtitle?: string; author?: string; seriesPill?: string;
  pageCount?: number; trim?: Trim; paper?: PaperType;
  frontArtId?: string; backBlurb?: string; barcodeCorner?: boolean;
  /** Framing and contrast controls. */
  fit?: "fill" | "fit"; padColor?: string; shift?: "top" | "center" | "bottom";
  titlePlacement?: "top" | "bottom" | "split"; scrim?: "none" | "softDark" | "softLight" | "pill";
  textColor?: string; textEffect?: "none" | "shadow" | "outline";
  /** Extra sky above the picture for Top and Split titles: the art moves down and the top color blends into the header band. */
  topSky?: "off" | "20" | "30";
  /** The settings snapshot the author approved. The cover counts as approved while it matches. */
  approvedSig?: string; approvedAt?: string; checkNotes?: string; checkedAt?: string;
  /** Saved Cover Ideas so they are not paid for twice. */
  ideas?: CoverIdeas;
  /** Up to 3 finished covers (image ids) whose look new cover ideas should match. */
  refCoverIds?: string[];
}
export interface CoverIdea { artId?: string; name: string; why: string; scene: string; layout: { titlePlacement: "top" | "bottom" | "split"; topSky: "off" | "20" | "30"; scrim: "none" | "softDark" | "softLight" | "pill"; textColor: string; textEffect: "none" | "shadow" | "outline" } }
export interface CoverIdeas { concepts: CoverIdea[]; tips: string[]; lookNotes?: string; model?: string; at?: string }
export type PaperType = "standardColor" | "premiumColor" | "white" | "cream";
export interface ReviewFix { id: string; title: string; detail: string; target: "notes" | "styleBible" | "sections" }
export interface AppliedLog { kind: "idea" | "qa"; at: string; changes: string[] }
