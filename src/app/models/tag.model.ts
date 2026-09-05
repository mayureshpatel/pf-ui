/**
 * Represents a user-defined label that can be attached to transactions, independent of category.
 *
 * Maps directly to the Tag entity in the database, without audit fields.
 *
 * @property id - The unique identifier of the tag.
 * @property userId - The ID of the user who owns the tag.
 * @property name - The tag's display name.
 * @property color - Optional UI color for the tag pill.
 */
export interface Tag {
  id: number;
  userId: number;
  name: string;
  color: string | null;
}

/**
 * Represents a request to create a tag.
 *
 * @property userId - The ID of the user creating the tag.
 * @property name - The tag's display name.
 * @property color - Optional UI color for the tag pill.
 */
export interface TagCreateRequest {
  userId: number;
  name: string;
  color?: string | null;
}

/**
 * Represents a request to rename/recolor an existing tag.
 *
 * @property id - The ID of the tag to update.
 * @property name - The tag's display name.
 * @property color - Optional UI color for the tag pill.
 */
export interface TagUpdateRequest {
  id: number;
  name: string;
  color?: string | null;
}
