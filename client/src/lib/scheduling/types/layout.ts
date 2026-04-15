/**
 * Unified Scheduling System - Layout Types
 *
 * Types for event positioning and layout calculations.
 */

import type { TimeItem } from "./time-item";

/**
 * Positioned item with calculated layout coordinates
 */
export interface PositionedItem {
  item: TimeItem;
  column: number;
  totalColumns: number;
  top: number; // percentage
  height: number; // percentage
  left: number; // percentage
  width: number; // percentage
}

/**
 * Positioned item with margins for better visibility
 */
export interface PositionedItemWithMargins extends PositionedItem {
  marginLeft: number;
  marginRight: number;
}

/**
 * Layout calculation result for an item
 */
export interface ItemLayout {
  top: number;
  height: number;
  left: number;
  width: number;
  column: number;
  totalColumns: number;
}
