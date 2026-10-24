// Everything that lives in a simulation is told apart by an id, which the simulation hands out in order. Things refer to each
// other by id, never by object, so that the state can be saved, replayed and written to a log as it is.
export type EntityId = number;
