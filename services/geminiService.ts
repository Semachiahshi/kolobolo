import { GoogleGenAI, Type } from "@google/genai";
import type { Room, Person, AssignmentResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export async function generateAssignment(rooms: Room[], people: Person[]): Promise<AssignmentResult> {
  const roomNameMap = new Map(rooms.map(r => [r.id, r.name]));
  const roomsForPrompt = rooms.map(r => ({
      name: r.name,
      capacity: r.capacity,
      bathroom: r.bathroom,
      floor: r.floor,
      connectedTo: r.connectedTo ? roomNameMap.get(r.connectedTo) || 'none' : 'none',
      sharedBathroomWith: r.sharedBathroomWith ? roomNameMap.get(r.sharedBathroomWith) || 'none' : 'none',
  }));
    
  const prompt = `
    You are an expert room assignment assistant. Your task is to assign people to rooms based on a set of rules and preferences.
    
    **Strict Rules (must be followed):**
    1. Room capacity cannot be exceeded.
    2. Genders (Muž/Žena) cannot be mixed in the same room.
    3. If two rooms share a bathroom (indicated by the 'sharedBathroomWith' property), they must be treated as a single unit for gender assignment. Both rooms must be assigned to people of the same gender (e.g., both male or both female).
    4. Strictly honor 'wantsToBeWith' requests. If person A wants to be with person B, they must be in the same room.
    5. Strictly honor 'doesNotWantToBeWith' requests. If person A does not want to be with person B, they must NOT be in the same room.

    **Preferences (try to satisfy as best as possible):**
    - Assign people to their preferred floor.
    - Match their bathroom preference (Společná/Vlastní).
    - Match their room preference (Samostatný/Spojený). A 'Spojený' (Connected) preference is fulfilled if a person is placed in a room that is connected to another (indicated by the 'connectedTo' property). A 'Samostatný' (Single) preference is best met by placing a person in a room that is not connected to any other.

    **Input Data:**
    Rooms: ${JSON.stringify(roomsForPrompt)}
    People: ${JSON.stringify(people.map(p => ({ name: p.name, gender: p.gender, preferredFloor: p.preferredFloor, wantsToBeWith: p.wantsToBeWith, doesNotWantToBeWith: p.doesNotWantToBeWith, bathroomPreference: p.bathroomPreference, roomPreference: p.roomPreference })))}

    **Output Instructions:**
    Provide the final assignment in the specified JSON format. For any person you cannot assign, place them in the 'unassignedPeople' list. The 'reason' for unassignment must be in clear, natural, and user-friendly Czech. Avoid technical jargon. For example, instead of "Conflict with 'doesNotWantToBeWith' preference for Jan Novák," write a reason like "Nelze umístit s Janem Novákem, protože si Jan nepřál být s touto osobou v pokoji."
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            assignments: {
              type: Type.ARRAY,
              description: "List of rooms and the people assigned to them.",
              items: {
                type: Type.OBJECT,
                properties: {
                  roomName: {
                    type: Type.STRING,
                    description: "The name of the room."
                  },
                  assignedPeople: {
                    type: Type.ARRAY,
                    description: "List of names of people assigned to this room.",
                    items: {
                      type: Type.STRING
                    }
                  },
                },
                required: ["roomName", "assignedPeople"],
              }
            },
            unassignedPeople: {
              type: Type.ARRAY,
              description: "List of people who could not be assigned and the reason.",
              items: {
                type: Type.OBJECT,
                properties: {
                  personName: {
                    type: Type.STRING,
                    description: "The name of the unassigned person."
                  },
                  reason: {
                    type: Type.STRING,
                    description: "The reason why the person could not be assigned."
                  }
                },
                required: ["personName", "reason"],
              }
            }
          },
          required: ["assignments", "unassignedPeople"],
        },
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as AssignmentResult;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate assignment. Please check the API key and your request.");
  }
}