export type PickerItem = {
  id: string;
  title: string;
  subtitle: string | null;
  date: string | null;
  /** Folders are navigable, not importable. */
  isFolder: boolean;
  alreadyInLasso: boolean;
  /** Labelled guess shown before import, e.g. "Call transcript". Never blocks. */
  hint?: string | null;
  /** Folders only: this folder is being watched for new work. */
  isWatched?: boolean;
};

export type PickerPage = {
  items: PickerItem[];
  nextPageToken: string | null;
  /** Set when a toolkit is connected but publishes no usable listing action. */
  unsupported: string | null;
  /** Gmail only: label chips that stand in for folders. */
  labels?: { id: string; name: string; query: string }[];
};
