// A box in a cell, axis-aligned: the cell is the unit cube from 0 to 1 in x, y and z. A box may stick out of the cell by a hair (see WALL_SKIN).
export interface CellBox {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}
