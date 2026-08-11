export type PickerItem = {
  id: string;
  title: string;
  subtitle: string | null;
  date: string | null;
  /** Folders are navigable, not importable. */
  isFolder: boolean;
  alreadyInLasso: boolean;
};

export type PickerPage = {
  items: PickerItem[];
  nextPageToken: string | null;
  /** Set when a toolkit is connected but publishes no usable listing action. */
  unsupported: string | null;
};
