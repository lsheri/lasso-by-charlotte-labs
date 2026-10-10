/**
 * The segmentation keys for anonymous benchmarking. ONE copy, shared by the
 * settings card and the onboarding step, so the two can never drift apart.
 */
export const INDUSTRIES = [
  "Professional services",
  "Technology",
  "Financial services",
  "Healthcare",
  "Public sector",
  "Education",
  "Manufacturing",
  "Retail",
  "Other",
];
export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

/**
 * SEG-1b: the one question an individual account answers. The stored values
 * are the only three the orgs.use_for check constraint accepts; the labels
 * are what the person reads. One copy, so the two can never drift apart.
 */
export const USE_FOR_OPTIONS = [
  { value: "work", label: "Work" },
  { value: "school", label: "School" },
  { value: "other", label: "Other" },
] as const;
