import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { BuildingConfig, Room, Person, Assignment, UnassignedPerson, SavedConfiguration } from './types';
import { Step, BathroomType, Gender, RoomPreference } from './types';
import { generateAssignment } from './services/geminiService';
import { BuildingIcon, HistoryIcon, PlusIcon, TrashIcon, ArrowRightIcon, ArrowLeftIcon, UserGroupIcon, SaveIcon, RefreshIcon, DownloadIcon, DuplicateIcon } from './components/Icons';

declare global {
    interface Window {
        jspdf: any;
    }
}

// --- Reusable UI Components ---

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white shadow-lg rounded-xl p-6 md:p-8 ${className}`}>
    {children}
  </div>
);

const Button: React.FC<{ onClick: () => void; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger'; className?: string, disabled?: boolean }> = ({ onClick, children, variant = 'primary', className = '', disabled = false }) => {
  const baseClasses = 'flex items-center justify-center font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100';
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
  };
  return <button onClick={onClick} className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={disabled}>{children}</button>;
};

const Input: React.FC<{ label: string; type: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; min?: number; }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
        <input {...props} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
/>
    </div>
);

// FIX: Allow `value` to be a string or number to support binding to state like `preferredFloor`.
const Select: React.FC<{ label: string; value: string | number; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode; }> = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
        <select {...props} className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white">
            {props.children}
        </select>
    </div>
);

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};

// --- Screen Components ---

const HomeScreen: React.FC<{ onNew: () => void; onContinue: () => void; onHistory: () => void; canContinue: boolean }> = ({ onNew, onContinue, onHistory, canContinue }) => (
    <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">Plánovač Rozřazení</h1>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">Vytvořte, spravujte a optimalizujte rozřazení osob do pokojů s lehkostí a s pomocí umělé inteligence.</p>
        <div className="space-y-4 max-w-sm mx-auto">
            <Button onClick={onNew} className="w-full text-lg"><BuildingIcon />Nová konfigurace budovy</Button>
            <Button onClick={onContinue} disabled={!canContinue} className="w-full text-lg"><UserGroupIcon />Pokračovat v uložené konfiguraci</Button>
            <Button onClick={onHistory} variant="secondary" className="w-full text-lg"><HistoryIcon />Historie</Button>
        </div>
    </div>
);

const BuildingConfigScreen: React.FC<{ onBack: () => void; onNext: (config: BuildingConfig) => void; initialConfig: BuildingConfig }> = ({ onBack, onNext, initialConfig }) => {
    const [config, setConfig] = useState(initialConfig);

    const handleNext = () => {
        if (config.floors > 0) {
            onNext(config);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Nastavení budovy</h2>
            <div className="space-y-4">
                <Input label="Nejvyšší číslo patra" type="number" min={1} value={config.floors} onChange={e => setConfig({ ...config, floors: parseInt(e.target.value, 10) || 1 })} />
                <div className="flex items-center">
                    <input id="groundFloor" type="checkbox" checked={config.hasGroundFloor} onChange={e => setConfig({ ...config, hasGroundFloor: e.target.checked })} className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
                    <label htmlFor="groundFloor" className="ml-2 block text-sm text-slate-900">Má přízemí?</label>
                </div>
            </div>
            <div className="flex justify-between mt-8">
                <Button onClick={onBack} variant="secondary"><ArrowLeftIcon />Zpět</Button>
                <Button onClick={handleNext} disabled={config.floors <= 0}><ArrowRightIcon />Pokračovat</Button>
            </div>
        </Card>
    );
};

const RoomConfigScreen: React.FC<{ buildingConfig: BuildingConfig; onBack: () => void; onNext: (rooms: Room[]) => void; initialRooms: Room[] }> = ({ buildingConfig, onBack, onNext, initialRooms }) => {
    const [rooms, setRooms] = useState<Room[]>(initialRooms);
    const floors = useMemo(() => (
        buildingConfig.hasGroundFloor
            ? Array.from({ length: buildingConfig.floors + 1 }, (_, i) => i)
            : Array.from({ length: buildingConfig.floors }, (_, i) => i + 1)
    ), [buildingConfig]);

    const [isBulkAddModalOpen, setIsBulkAddModalOpen] = useState(false);
    const [selectedFloorForBulkAdd, setSelectedFloorForBulkAdd] = useState<number | null>(null);
    
    const initialBulkConfig = {
        count: 3,
        roomNames: Array(3).fill(''),
        capacity: 2,
        bathroom: BathroomType.SHARED,
    };
    const [bulkAddConfig, setBulkAddConfig] = useState(initialBulkConfig);

    const openBulkAddModal = (floor: number) => {
        const roomsOnFloor = rooms.filter(r => r.floor === floor).length;
        const defaultNames = Array.from({ length: 3 }, (_, i) => `Pokoj ${roomsOnFloor + i + 1}`);
        setBulkAddConfig({
            count: 3,
            roomNames: defaultNames,
            capacity: 2,
            bathroom: BathroomType.SHARED,
        });
        setSelectedFloorForBulkAdd(floor);
        setIsBulkAddModalOpen(true);
    };

    const handleBulkCountChange = (newCount: number) => {
        const count = Math.max(1, newCount || 1);
        const roomsOnFloor = rooms.filter(r => r.floor === selectedFloorForBulkAdd).length;
        const oldNames = bulkAddConfig.roomNames;
        const newNames = Array.from({ length: count }, (_, i) => oldNames[i] || `Pokoj ${roomsOnFloor + oldNames.length + i + 1}`);
        setBulkAddConfig(prev => ({ ...prev, count, roomNames: newNames }));
    };

    const handleBulkRoomNameChange = (index: number, name: string) => {
        const newNames = [...bulkAddConfig.roomNames];
        newNames[index] = name;
        setBulkAddConfig(prev => ({ ...prev, roomNames: newNames }));
    };

    const handleBulkAddRooms = () => {
        if (selectedFloorForBulkAdd === null || bulkAddConfig.count <= 0) return;
        if (bulkAddConfig.roomNames.some(name => name.trim() === '')) return;

        const newRooms: Room[] = bulkAddConfig.roomNames.map(name => ({
            id: crypto.randomUUID(),
            floor: selectedFloorForBulkAdd,
            name: name,
            capacity: bulkAddConfig.capacity,
            bathroom: bulkAddConfig.bathroom,
        }));

        setRooms([...rooms, ...newRooms]);
        setIsBulkAddModalOpen(false);
    };


    const addRoom = (floor: number) => {
        const newRoom: Room = {
            id: crypto.randomUUID(),
            floor,
            name: `Pokoj ${rooms.filter(r => r.floor === floor).length + 1}`,
            capacity: 2,
            bathroom: BathroomType.SHARED,
        };
        setRooms([...rooms, newRoom]);
    };
    
    const updateRoom = (id: string, field: keyof Room, value: any) => {
        setRooms(currentRooms => {
            let newRooms = [...currentRooms];
    
            if (field === 'connectedTo' || field === 'sharedBathroomWith') {
                const partnerField: keyof Room = field;
                const selfField: keyof Room = field;
    
                newRooms = currentRooms.map(r => ({ ...r }));
                const roomA = newRooms.find(r => r.id === id);
                if (!roomA) return currentRooms;
    
                const newPartnerBId = value || undefined;
                const oldPartnerAId = roomA[selfField];
    
                // 1. Break A's old connection
                if (oldPartnerAId) {
                    const oldPartnerA = newRooms.find(r => r.id === oldPartnerAId);
                    if (oldPartnerA) {
                        oldPartnerA[partnerField] = undefined;
                    }
                }
    
                // 2. If establishing a new connection
                if (newPartnerBId) {
                    const roomB = newRooms.find(r => r.id === newPartnerBId);
                    if (roomB) {
                        // 2a. Break B's old connection
                        const oldPartnerBId = roomB[partnerField];
                        if (oldPartnerBId) {
                            const oldPartnerB = newRooms.find(r => r.id === oldPartnerBId);
                            if (oldPartnerB) {
                                oldPartnerB[partnerField] = undefined;
                            }
                        }
    
                        // 2b. Form the new two-way connection
                        roomB[partnerField] = id;
                        roomA[selfField] = newPartnerBId;

                        // 2c. If it's a bathroom share, ensure both rooms are 'Shared'
                        if(partnerField === 'sharedBathroomWith'){
                            roomA.bathroom = BathroomType.SHARED;
                            roomB.bathroom = BathroomType.SHARED;
                        }

                    }
                } else { // 3. If just clearing the connection
                    roomA[selfField] = undefined;
                }
                return newRooms;
            } 
            
            if (field === 'bathroom' && value === BathroomType.PRIVATE) {
                newRooms = currentRooms.map(r => ({ ...r }));
                const roomA = newRooms.find(r => r.id === id);
                if (!roomA) return currentRooms;

                const oldPartnerAId = roomA.sharedBathroomWith;
                if (oldPartnerAId) {
                    const oldPartnerA = newRooms.find(r => r.id === oldPartnerAId);
                    if (oldPartnerA) {
                        oldPartnerA.sharedBathroomWith = undefined;
                    }
                }
                
                roomA.bathroom = BathroomType.PRIVATE;
                roomA.sharedBathroomWith = undefined;

                return newRooms;

            }
            
            // Default case for other fields
            return currentRooms.map(r => r.id === id ? { ...r, [field]: value } : r);
        });
    };

    const removeRoom = (id: string) => {
        setRooms(rooms.filter(r => r.id !== id));
    };

    return (
        <div className="w-full max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Nastavení pokojů</h2>
            <div className="space-y-8">
                {floors.map(floor => (
                    <Card key={floor}>
                        <h3 className="text-xl font-bold mb-4">Patro {floor === 0 ? 'Přízemí' : floor}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {rooms.filter(r => r.floor === floor).map(room => (
                                <div key={room.id} className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
                                    <Input label="Název pokoje" type="text" value={room.name} onChange={e => updateRoom(room.id, 'name', e.target.value)} />
                                    <Input label="Kapacita" type="number" min={1} value={room.capacity} onChange={e => updateRoom(room.id, 'capacity', parseInt(e.target.value, 10) || 1)} />
                                    <Select label="Typ koupelny" value={room.bathroom} onChange={e => updateRoom(room.id, 'bathroom', e.target.value as BathroomType)}>
                                        {Object.values(BathroomType).map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                    </Select>
                                    {room.bathroom === BathroomType.SHARED && (
                                        <Select label="Sdílená s pokojem" value={room.sharedBathroomWith || ''} onChange={e => updateRoom(room.id, 'sharedBathroomWith', e.target.value)}>
                                            <option value="">Žádné</option>
                                            {rooms.filter(r => r.id !== room.id && !r.sharedBathroomWith).map(r => <option key={r.id} value={r.id}>{r.name} (Patro {r.floor})</option>)}
                                        </Select>
                                    )}
                                    <Select label="Spojení s jiným pokojem" value={room.connectedTo || ''} onChange={e => updateRoom(room.id, 'connectedTo', e.target.value)}>
                                        <option value="">Žádné</option>
                                        {rooms.filter(r => r.id !== room.id).map(r => <option key={r.id} value={r.id}>{r.name} (Patro {r.floor})</option>)}
                                    </Select>
                                    <Button onClick={() => removeRoom(room.id)} variant="danger" className="w-full mt-2"><TrashIcon />Odstranit</Button>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                            <Button onClick={() => addRoom(floor)} variant="secondary" className="text-sm"><PlusIcon />Přidat pokoj</Button>
                            <Button onClick={() => openBulkAddModal(floor)} variant="secondary" className="text-sm"><DuplicateIcon />Přidat více pokojů</Button>
                        </div>
                    </Card>
                ))}
            </div>
             <Modal 
                isOpen={isBulkAddModalOpen} 
                onClose={() => setIsBulkAddModalOpen(false)} 
                title={`Hromadné přidání pokojů (Patro ${selectedFloorForBulkAdd === 0 ? 'Přízemí' : selectedFloorForBulkAdd})`}>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <Input 
                        label="Počet pokojů" 
                        type="number" 
                        min={1} 
                        value={bulkAddConfig.count} 
                        onChange={e => handleBulkCountChange(parseInt(e.target.value, 10))}
                    />
                    <hr className="my-4"/>
                    {bulkAddConfig.roomNames.map((name, index) => (
                        <Input
                            key={index}
                            label={`Název pokoje ${index + 1}`}
                            type="text"
                            value={name}
                            onChange={e => handleBulkRoomNameChange(index, e.target.value)}
                        />
                    ))}
                    <hr className="my-4"/>
                     <Input 
                        label="Kapacita pro všechny" 
                        type="number" 
                        min={1} 
                        value={bulkAddConfig.capacity} 
                        onChange={e => setBulkAddConfig({ ...bulkAddConfig, capacity: parseInt(e.target.value, 10) || 1 })} 
                    />
                    <Select 
                        label="Typ koupelny pro všechny" 
                        value={bulkAddConfig.bathroom} 
                        onChange={e => setBulkAddConfig({ ...bulkAddConfig, bathroom: e.target.value as BathroomType })}
                    >
                        {Object.values(BathroomType).map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </Select>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button onClick={() => setIsBulkAddModalOpen(false)} variant="secondary">Zrušit</Button>
                    <Button onClick={handleBulkAddRooms} disabled={bulkAddConfig.roomNames.some(name => name.trim() === '')}>Přidat pokoje</Button>
                </div>
            </Modal>
            <div className="flex justify-between mt-8">
                <Button onClick={onBack} variant="secondary"><ArrowLeftIcon />Zpět</Button>
                <Button onClick={() => onNext(rooms)} disabled={rooms.length === 0}><ArrowRightIcon />Pokračovat k přidávání lidí</Button>
            </div>
        </div>
    );
};

const AddPeopleScreen: React.FC<{ onBack: () => void; onNext: (people: Person[]) => void; initialPeople: Person[], buildingConfig: BuildingConfig }> = ({ onBack, onNext, initialPeople, buildingConfig }) => {
    const [people, setPeople] = useState<Person[]>(initialPeople);
    const defaultPerson: Person = {
        id: '', name: '', gender: Gender.MALE, preferredFloor: undefined, roomPreference: RoomPreference.SINGLE,
        bathroomPreference: BathroomType.SHARED, wantsToBeWith: '', doesNotWantToBeWith: ''
    };
    const [newPerson, setNewPerson] = useState<Person>(defaultPerson);

    const addPerson = () => {
        if (newPerson.name.trim()) {
            setPeople([...people, { ...newPerson, id: crypto.randomUUID() }]);
            setNewPerson(defaultPerson);
        }
    };
    
    const removePerson = (id: string) => {
        setPeople(people.filter(p => p.id !== id));
    };
    
    const floors = useMemo(() => (
        buildingConfig.hasGroundFloor
            ? Array.from({ length: buildingConfig.floors + 1 }, (_, i) => i)
            : Array.from({ length: buildingConfig.floors }, (_, i) => i + 1)
    ), [buildingConfig]);

    return (
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1 h-fit sticky top-8">
                <h2 className="text-2xl font-bold mb-4">Přidat osobu</h2>
                <div className="space-y-3">
                    <Input label="Jméno" type="text" value={newPerson.name} onChange={e => setNewPerson({ ...newPerson, name: e.target.value })} placeholder="Jan Novák" />
                    <Select label="Pohlaví" value={newPerson.gender} onChange={e => setNewPerson({ ...newPerson, gender: e.target.value as Gender })}>
                        {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
                    </Select>
                    <Select label="Preferované patro" value={newPerson.preferredFloor ?? ''} onChange={e => setNewPerson({ ...newPerson, preferredFloor: e.target.value ? parseInt(e.target.value) : undefined })}>
                        <option value="">Bez preference</option>
                        {floors.map(f => <option key={f} value={f}>{f === 0 ? 'Přízemí' : `${f}. patro`}</option>)}
                    </Select>
                    <Select label="Pokoj" value={newPerson.roomPreference} onChange={e => setNewPerson({ ...newPerson, roomPreference: e.target.value as RoomPreference })}>
                        {Object.values(RoomPreference).map(rp => <option key={rp} value={rp}>{rp}</option>)}
                    </Select>
                    <Select label="Koupelna" value={newPerson.bathroomPreference} onChange={e => setNewPerson({ ...newPerson, bathroomPreference: e.target.value as BathroomType })}>
                        {Object.values(BathroomType).map(bt => <option key={bt} value={bt}>{bt}</option>)}
                    </Select>
                    <Input label="S kým chce být (jména, odděleno čárkou)" type="text" value={newPerson.wantsToBeWith} onChange={e => setNewPerson({ ...newPerson, wantsToBeWith: e.target.value })} />
                    <Input label="S kým nechce být (jména, odděleno čárkou)" type="text" value={newPerson.doesNotWantToBeWith} onChange={e => setNewPerson({ ...newPerson, doesNotWantToBeWith: e.target.value })} />
                    <Button onClick={addPerson} className="w-full mt-2" disabled={!newPerson.name.trim()}><PlusIcon />Uložit osobu</Button>
                </div>
            </Card>
            <div className="lg:col-span-2">
                <h2 className="text-2xl font-bold mb-4">Seznam osob ({people.length})</h2>
                <div className="space-y-3">
                    {people.length > 0 ? people.map(person => (
                        <div key={person.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow">
                            <div>
                                <p className="font-bold">{person.name} <span className="font-normal text-sm text-slate-500">({person.gender})</span></p>
                            </div>
                            <Button onClick={() => removePerson(person.id)} variant="danger"><TrashIcon /></Button>
                        </div>
                    )) : <p className="text-slate-500 text-center py-8">Zatím nebyly přidány žádné osoby.</p>}
                </div>
                 <div className="flex justify-between mt-8">
                    <Button onClick={onBack} variant="secondary"><ArrowLeftIcon />Zpět</Button>
                    <Button onClick={() => onNext(people)} disabled={people.length === 0}><ArrowRightIcon />Pokračovat k rozřazení</Button>
                </div>
            </div>
        </div>
    );
};

const PersonChip: React.FC<{ person: Person; onDragStart: (e: React.DragEvent, person: Person) => void }> = ({ person, onDragStart }) => (
    <div
        draggable
        onDragStart={(e) => onDragStart(e, person)}
        className={`flex items-center p-2 rounded-md cursor-grab active:cursor-grabbing text-sm font-medium ${person.gender === Gender.MALE ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}
    >
        {person.name}
    </div>
);

const AssignmentScreen: React.FC<{ rooms: Room[], people: Person[], onBack: () => void; onSave: (assignment: Assignment) => void; onExport: (format: 'csv' | 'pdf') => void; }> = ({ rooms, people, onBack, onSave, onExport }) => {
    const [assignment, setAssignment] = useState<Assignment>({});
    const [unassigned, setUnassigned] = useState<UnassignedPerson[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const peopleMap = useMemo(() => new Map(people.map(p => [p.name, p])), [people]);

    const runAssignment = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await generateAssignment(rooms, people);
            const newAssignment: Assignment = {};
            rooms.forEach(r => newAssignment[r.id] = []);
            
            result.assignments.forEach(a => {
                const room = rooms.find(r => r.name === a.roomName);
                if (room) {
                    newAssignment[room.id] = a.assignedPeople.map(name => peopleMap.get(name)).filter((p): p is Person => p !== undefined);
                }
            });

            setAssignment(newAssignment);
            setUnassigned(result.unassignedPeople);

        } catch (error) {
            console.error(error);
            alert("Došlo k chybě při generování rozřazení.");
        } finally {
            setIsLoading(false);
        }
    }, [rooms, people, peopleMap]);

    useEffect(() => {
      runAssignment();
       // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDragStart = (e: React.DragEvent, person: Person) => {
        e.dataTransfer.setData("personId", person.id);
    };

    const handleDrop = (e: React.DragEvent, targetRoomId: string) => {
        e.preventDefault();
        const personId = e.dataTransfer.getData("personId");
        const personToMove = people.find(p => p.id === personId);
        if (!personToMove) return;

        setAssignment(prev => {
            const newAssignment = { ...prev };
            // Remove from old room
            Object.keys(newAssignment).forEach(roomId => {
                newAssignment[roomId] = newAssignment[roomId].filter(p => p.id !== personId);
            });
            // Add to new room
            newAssignment[targetRoomId] = [...newAssignment[targetRoomId], personToMove];
            return newAssignment;
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    
    const unassignedPeopleList = useMemo(() => {
        const assignedIds = new Set(Object.values(assignment).flat().map(p => p.id));
        return people.filter(p => !assignedIds.has(p.id));
    }, [assignment, people]);

    return (
        <div className="w-full max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Rozřazení do pokojů</h2>
            {isLoading ? (
                <div className="text-center py-20">
                    <p className="text-xl text-slate-600">AI generuje optimální rozřazení...</p>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mt-4"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   <Card className="md:col-span-2 lg:col-span-4 flex flex-wrap justify-center items-center gap-4">
                       <Button onClick={onBack} variant="secondary"><ArrowLeftIcon/>Zpět</Button>
                       <Button onClick={runAssignment} variant="secondary" className="flex items-center"><RefreshIcon/>Obnovit automatické rozřazení</Button>
                       <Button onClick={() => onExport('csv')} variant="secondary"><DownloadIcon /><span className="ml-2">Export CSV</span></Button>
                       <Button onClick={() => onExport('pdf')} variant="secondary"><DownloadIcon /><span className="ml-2">Export PDF</span></Button>
                       <Button onClick={() => onSave(assignment)} className="flex items-center"><SaveIcon/><span className="ml-2">Uložit a dokončit</span></Button>
                   </Card>

                    <div className="lg:col-span-1 space-y-4">
                        <Card>
                            <h3 className="font-bold text-lg mb-2">Nezařazení</h3>
                            <div className="space-y-2">
                                {unassignedPeopleList.map(person => <PersonChip key={person.id} person={person} onDragStart={handleDragStart} />)}
                                {unassignedPeopleList.length === 0 && <p className="text-sm text-slate-500">Všichni jsou zařazeni.</p>}
                            </div>
                        </Card>
                         {unassigned.length > 0 && <Card>
                            <h3 className="font-bold text-lg mb-2 text-red-600">Problémy přiřazení</h3>
                            <ul className="space-y-2 list-disc list-inside text-sm">
                                {unassigned.map(u => <li key={u.personName}><strong>{u.personName}:</strong> {u.reason}</li>)}
                            </ul>
                        </Card>}
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rooms.map(room => {
                            const assignedPeople = assignment[room.id] || [];
                            const capacityStatus = assignedPeople.length / room.capacity;
                            const bgColor = capacityStatus > 1 ? 'bg-red-50' : capacityStatus === 1 ? 'bg-green-50' : 'bg-white';
                            return (
                                <div
                                    key={room.id}
                                    onDrop={(e) => handleDrop(e, room.id)}
                                    onDragOver={handleDragOver}
                                    className={`p-4 rounded-lg shadow-md border ${bgColor}`}
                                >
                                    <h4 className="font-bold">{room.name}</h4>
                                    <p className="text-sm text-slate-500 mb-2">Kapacita: {assignedPeople.length} / {room.capacity} | {room.bathroom}</p>
                                    <div className="space-y-2 min-h-[50px] bg-slate-100 p-2 rounded">
                                        {assignedPeople.map(person => <PersonChip key={person.id} person={person} onDragStart={handleDragStart} />)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const SaveScreen: React.FC<{ onHistory: () => void; onHome: () => void; onExport: (format: 'json'|'csv'|'pdf') => void; }> = ({ onHistory, onHome, onExport }) => (
    <Card className="w-full max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">Uloženo!</h2>
        <p className="text-slate-600 mb-8">Vaše konfigurace a rozřazení bylo úspěšně uloženo.</p>
        <div className="space-y-3">
            <Button onClick={() => onExport('json')} variant="secondary" className="w-full"><DownloadIcon /><span className="ml-2">Exportovat jako JSON</span></Button>
            <Button onClick={() => onExport('csv')} variant="secondary" className="w-full"><DownloadIcon /><span className="ml-2">Exportovat jako CSV</span></Button>
            <Button onClick={() => onExport('pdf')} variant="secondary" className="w-full"><DownloadIcon /><span className="ml-2">Exportovat jako PDF</span></Button>
            <Button onClick={onHistory} className="w-full"><HistoryIcon />Zobrazit historii</Button>
            <Button onClick={onHome} className="w-full"><BuildingIcon />Zpět na úvodní obrazovku</Button>
        </div>
    </Card>
);

const HistoryScreen: React.FC<{ onBack: () => void; onLoad: (config: SavedConfiguration) => void; }> = ({ onBack, onLoad }) => {
    const [history, setHistory] = useState<SavedConfiguration[]>([]);
    
    useEffect(() => {
        const storedHistory = localStorage.getItem('assignmentHistory');
        if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
        }
    }, []);

    const deleteConfig = (id: string) => {
        const newHistory = history.filter(h => h.id !== id);
        setHistory(newHistory);
        localStorage.setItem('assignmentHistory', JSON.stringify(newHistory));
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-center">Historie Konfigurací</h2>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {history.length > 0 ? history.sort((a,b) => b.timestamp - a.timestamp).map(config => (
                    <div key={config.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-lg shadow-sm">
                        <div>
                            <p className="font-bold">{config.name}</p>
                            <p className="text-sm text-slate-500">{new Date(config.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => onLoad(config)} variant="secondary">Načíst</Button>
                            <Button onClick={() => deleteConfig(config.id)} variant="danger"><TrashIcon /></Button>
                        </div>
                    </div>
                )) : <p className="text-slate-500 text-center py-8">Žádné uložené konfigurace.</p>}
            </div>
            <div className="mt-8 text-center">
                <Button onClick={onBack} variant="secondary"><ArrowLeftIcon />Zpět</Button>
            </div>
        </Card>
    );
};

// --- Main App Component ---

export default function App() {
    const [step, setStep] = useState<Step>(Step.HOME);
    const [buildingConfig, setBuildingConfig] = useState<BuildingConfig>({ floors: 3, hasGroundFloor: true });
    const [rooms, setRooms] = useState<Room[]>([]);
    const [people, setPeople] = useState<Person[]>([]);
    const [assignment, setAssignment] = useState<Assignment>({});
    const [hasSavedSession, setHasSavedSession] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('currentSession')) {
            setHasSavedSession(true);
        }
    }, []);

    const saveSession = useCallback(() => {
        const session = { step, buildingConfig, rooms, people, assignment };
        localStorage.setItem('currentSession', JSON.stringify(session));
        setHasSavedSession(true);
    }, [step, buildingConfig, rooms, people, assignment]);

    const loadSession = () => {
        const sessionStr = localStorage.getItem('currentSession');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            setStep(session.step || Step.BUILDING_CONFIG);
            setBuildingConfig(session.buildingConfig);
            setRooms(session.rooms);
            setPeople(session.people);
            setAssignment(session.assignment);
        }
    };
    
    const handleSaveAssignment = (finalAssignment: Assignment) => {
        setAssignment(finalAssignment);
        const configName = prompt("Zadejte název pro tuto konfiguraci:", `Konfigurace ${new Date().toLocaleDateString()}`);
        if(configName){
            const newSavedConfig: SavedConfiguration = {
                id: crypto.randomUUID(),
                name: configName,
                timestamp: Date.now(),
                building: buildingConfig,
                rooms,
                people,
                assignment: finalAssignment,
            };
            const history = JSON.parse(localStorage.getItem('assignmentHistory') || '[]');
            history.push(newSavedConfig);
            localStorage.setItem('assignmentHistory', JSON.stringify(history));
            localStorage.removeItem('currentSession');
            setHasSavedSession(false);
            setStep(Step.SAVED);
        }
    };
    
    const handleLoadFromHistory = (config: SavedConfiguration) => {
        setBuildingConfig(config.building);
        setRooms(config.rooms);
        setPeople(config.people);
        setAssignment(config.assignment);
        setStep(Step.ASSIGNMENT);
    };

    const handleExport = (format: 'json' | 'csv' | 'pdf') => {
        const data = { buildingConfig, rooms, people, assignment };
        let content = '';
        let filename = '';
        let mimeType = '';

        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            filename = 'assignment.json';
            mimeType = 'application/json';
        } else if (format === 'csv') {
            let csv = 'Room Name,Person Name,Gender\n';
            Object.entries(assignment).forEach(([roomId, assignedPeople]) => {
                const room = rooms.find(r => r.id === roomId);
                if (room) {
                    assignedPeople.forEach(person => {
                        csv += `"${room.name}","${person.name}","${person.gender}"\n`;
                    });
                }
            });
            content = csv;
            filename = 'assignment.csv';
            mimeType = 'text/csv';
        } else if (format === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const sortedFloors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
            let y = 20;

            doc.setFontSize(18);
            doc.text('Rozřazení do pokojů', 105, y, { align: 'center' });
            y += 10;
            doc.setFontSize(10);
            doc.text(new Date().toLocaleString('cs-CZ'), 105, y, { align: 'center' });
            y += 15;

            sortedFloors.forEach(floor => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                doc.setFontSize(14);
                doc.text(`Patro ${floor === 0 ? 'Přízemí' : floor}`, 14, y);
                y += 8;

                const roomsOnFloor = rooms.filter(r => r.floor === floor).sort((a, b) => a.name.localeCompare(b.name));
                roomsOnFloor.forEach(room => {
                    if (y > 280) {
                       doc.addPage();
                       y = 20;
                    }
                    const assigned = assignment[room.id] || [];
                    doc.setFontSize(12);
                    doc.text(`${room.name} (${assigned.length}/${room.capacity})`, 20, y);
                    y += 6;

                    doc.setFontSize(10);
                    if (assigned.length > 0) {
                        assigned.forEach(person => {
                            if (y > 280) {
                                doc.addPage();
                                y = 20;
                            }
                            doc.text(`- ${person.name} (${person.gender})`, 25, y);
                            y += 5;
                        });
                    } else {
                         doc.text('- Prázdný', 25, y);
                         y += 5;
                    }
                     y += 4;
                });
            });

            doc.save('assignment.pdf');
            return; // Exit after saving PDF
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const resetToHome = () => {
        setBuildingConfig({ floors: 3, hasGroundFloor: true });
        setRooms([]);
        setPeople([]);
        setAssignment({});
        setStep(Step.HOME);
    };

    useEffect(() => {
        if (step !== Step.HOME && step !== Step.SAVED) {
            saveSession();
        }
    }, [step, buildingConfig, rooms, people, assignment, saveSession]);

    const renderStep = () => {
        switch (step) {
            case Step.BUILDING_CONFIG:
                return <BuildingConfigScreen
                    initialConfig={buildingConfig}
                    onBack={() => setStep(Step.HOME)}
                    onNext={config => { setBuildingConfig(config); setStep(Step.ROOM_CONFIG); }}
                />;
            case Step.ROOM_CONFIG:
                return <RoomConfigScreen
                    buildingConfig={buildingConfig}
                    initialRooms={rooms}
                    onBack={() => setStep(Step.BUILDING_CONFIG)}
                    onNext={newRooms => { setRooms(newRooms); setStep(Step.ADD_PEOPLE); }}
                />;
            case Step.ADD_PEOPLE:
                return <AddPeopleScreen
                    buildingConfig={buildingConfig}
                    initialPeople={people}
                    onBack={() => setStep(Step.ROOM_CONFIG)}
                    onNext={newPeople => { setPeople(newPeople); setStep(Step.ASSIGNMENT); }}
                />;
            case Step.ASSIGNMENT:
                return <AssignmentScreen
                    rooms={rooms}
                    people={people}
                    onBack={() => setStep(Step.ADD_PEOPLE)}
                    onSave={handleSaveAssignment}
                    onExport={handleExport}
                />;
            case Step.SAVED:
                return <SaveScreen onHome={resetToHome} onHistory={() => setStep(Step.HISTORY)} onExport={handleExport} />;
            case Step.HISTORY:
                return <HistoryScreen onBack={resetToHome} onLoad={handleLoadFromHistory} />;
            case Step.HOME:
            default:
                return <HomeScreen
                    onNew={() => setStep(Step.BUILDING_CONFIG)}
                    onContinue={loadSession}
                    onHistory={() => setStep(Step.HISTORY)}
                    canContinue={hasSavedSession}
                />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <main className="w-full">
                {renderStep()}
            </main>
        </div>
    );
}