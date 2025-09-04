
export enum Step {
  HOME,
  BUILDING_CONFIG,
  ROOM_CONFIG,
  ADD_PEOPLE,
  ASSIGNMENT,
  SAVED,
  HISTORY,
}

export interface BuildingConfig {
  floors: number;
  hasGroundFloor: boolean;
}

export enum BathroomType {
  SHARED = 'Společná',
  PRIVATE = 'Vlastní',
}

export interface Room {
  id: string;
  floor: number;
  name: string;
  capacity: number;
  bathroom: BathroomType;
  connectedTo?: string;
  sharedBathroomWith?: string;
}

export enum Gender {
  MALE = 'Muž',
  FEMALE = 'Žena',
}

export enum RoomPreference {
  SINGLE = 'Samostatný',
  CONNECTED = 'Spojený',
}

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  preferredFloor: number | undefined;
  roomPreference: RoomPreference;
  bathroomPreference: BathroomType;
  wantsToBeWith: string;
  doesNotWantToBeWith: string;
}

export interface Assignment {
  [roomId: string]: Person[];
}

export interface UnassignedPerson {
    personName: string;
    reason: string;
}

export interface AssignmentResult {
    assignments: { roomName: string; assignedPeople: string[] }[];
    unassignedPeople: UnassignedPerson[];
}

export interface SavedConfiguration {
    id: string;
    name: string;
    timestamp: number;
    building: BuildingConfig;
    rooms: Room[];
    people: Person[];
    assignment: Assignment;
}