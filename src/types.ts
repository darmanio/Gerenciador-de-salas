export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  description: string;
}

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  createdAt: any; // Firestore Timestamp
}
