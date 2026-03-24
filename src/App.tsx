import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Users, 
  DoorOpen, 
  Clock, 
  Trash2, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Search,
  RefreshCw,
  Key,
  Mail,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  orderBy, 
  limit,
  Timestamp,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { 
  format, 
  parse, 
  isSameDay, 
  isSameMonth,
  isBefore, 
  differenceInHours,
  areIntervalsOverlapping,
  subHours,
  eachDayOfInterval,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Firebase
import { db, auth } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

// Secondary Auth for creating users without signing out the admin
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

// Types
type UserRole = 'admin' | 'user';

interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  description: string;
}

interface Booking {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: Timestamp;
}

interface ReleasedPeriod {
  id: string;
  month: string; // YYYY-MM
  releasedBy: string;
  releasedAt: Timestamp;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: Timestamp;
}

// Helper for activity logging
const logActivity = async (profile: UserProfile, action: string, details: string) => {
  console.log(`LOGGING: ${action} - ${details}`);
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId: profile.uid,
      userName: profile.name,
      action,
      details,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// --- Components ---

const Notification = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, x: '-50%' }}
      animate={{ opacity: 1, y: 20, x: '-50%' }}
      exit={{ opacity: 0, y: -20, x: '-50%' }}
      className={`fixed top-0 left-1/2 z-[200] px-6 py-3 rounded-xl border shadow-lg flex items-center gap-3 min-w-[300px] ${colors[type]}`}
    >
      {icons[type]}
      <span className="flex-1 font-medium">{message}</span>
      <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const CalendarView = ({ bookings, rooms }: { bookings: Booking[], rooms: Room[] }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRoomId, setSelectedRoomId] = useState<string>('all');

  const filteredBookings = useMemo(() => {
    if (selectedRoomId === 'all') return bookings;
    return bookings.filter(b => b.roomId === selectedRoomId);
  }, [bookings, selectedRoomId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-neutral-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-sm font-bold text-neutral-500 whitespace-nowrap">Filtrar por Sala:</label>
          <select 
            value={selectedRoomId}
            onChange={(e) => setSelectedRoomId(e.target.value)}
            className="flex-1 sm:w-48 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as Salas</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-neutral-200 border border-neutral-200 rounded-xl overflow-hidden">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="bg-neutral-50 p-2 text-center text-xs font-bold text-neutral-500 uppercase">
            {day}
          </div>
        ))}
        {days.map((day, i) => {
          const dayBookings = filteredBookings.filter(b => b.date === format(day, 'yyyy-MM-dd'));
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={i} 
              className={`min-h-[100px] bg-white p-2 transition-colors ${!isCurrentMonth ? 'bg-neutral-50/50' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`text-sm font-semibold ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-neutral-900'} ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                  {format(day, 'd')}
                </span>
                {dayBookings.length > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                    {dayBookings.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {dayBookings.slice(0, 3).map(b => (
                  <div key={b.id} className="text-[10px] p-1 bg-neutral-100 rounded truncate text-neutral-700 border-l-2 border-blue-500">
                    <span className="font-bold">{b.startTime}</span> {b.roomName}
                  </div>
                ))}
                {dayBookings.length > 3 && (
                  <div className="text-[10px] text-neutral-400 pl-1">
                    + {dayBookings.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [releasedPeriods, setReleasedPeriods] = useState<ReleasedPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  const [adminTab, setAdminTab] = useState<'bookings' | 'rooms' | 'users' | 'summary' | 'calendar' | 'periods' | 'usage' | 'logs'>('bookings');

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const q = query(collection(db, 'users'), where('uid', '==', u.uid));
        const snap = await getDocs(q);
        let currentProfile: UserProfile;
        if (snap.empty) {
          currentProfile = {
            uid: u.uid,
            name: u.displayName || 'Usuário',
            email: u.email || '',
            role: u.email?.toLowerCase() === 'darmanio@gmail.com' ? 'admin' : 'user'
          };
          await setDoc(doc(db, 'users', u.uid), currentProfile);
        } else {
          currentProfile = snap.docs[0].data() as UserProfile;
          // Force admin role for the specific email
          if (u.email?.toLowerCase() === 'darmanio@gmail.com' && currentProfile.role !== 'admin') {
            console.log('Forçando papel admin para darmanio@gmail.com');
            currentProfile.role = 'admin';
            await updateDoc(doc(db, 'users', u.uid), { role: 'admin' });
          }
        }
        console.log('Perfil carregado:', currentProfile);
        setProfile(currentProfile);
        setUser(u);
        logActivity(currentProfile, 'LOGIN', 'Usuário entrou no sistema');
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    const unsubscribePeriods = onSnapshot(collection(db, 'releasedPeriods'), (snap) => {
      setReleasedPeriods(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReleasedPeriod)));
    });

    return () => {
      unsubscribe();
      unsubscribePeriods();
    };
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
      notify('Erro ao fazer login.', 'error');
    }
  };

  const handleLogout = async () => {
    if (profile) {
      await logActivity(profile, 'LOGOUT', 'Usuário saiu do sistema');
    }
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-neutral-200"
        >
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <CalendarIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">RoomBook</h1>
          <p className="text-neutral-500 mb-8">Sistema inteligente de agendamento de salas.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-neutral-200"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <AnimatePresence>
        {notification && (
          <Notification 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </AnimatePresence>

      <header className="bg-white border-b border-neutral-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">RoomBook</span>
            </div>

            <div className="flex items-center gap-4">
              {profile?.role === 'admin' && (
                <div className="hidden sm:flex bg-neutral-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setView('dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'dashboard' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                  >
                    Painel
                  </button>
                  <button 
                    onClick={() => {
                      setAdminTab('bookings');
                      setView('admin');
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'admin' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                  >
                    Administração
                  </button>
                </div>
              )}

              {profile?.email?.toLowerCase() === 'darmanio@gmail.com' && (
                <div className="hidden sm:flex items-center gap-2 ml-2">
                  <button 
                    onClick={() => {
                      setAdminTab('logs');
                      setView('admin');
                    }}
                    className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Logs de Atividade"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 pl-4 border-l border-neutral-200">
                <div className="text-right hidden xs:block">
                  <p className="text-sm font-bold leading-none">{profile?.name}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{profile?.email}</p>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-1">
                    {profile?.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </p>
                </div>
                {user?.providerData[0]?.providerId === 'password' && (
                  <button 
                    onClick={() => setIsChangePasswordModalOpen(true)}
                    className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Alterar Senha"
                  >
                    <Key className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-2.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Sair"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <Dashboard profile={profile!} notify={notify} releasedPeriods={releasedPeriods} />
          ) : (
            <AdminPanel profile={profile!} notify={notify} releasedPeriods={releasedPeriods} initialTab={adminTab} />
          )}
        </AnimatePresence>
      </main>

      {isChangePasswordModalOpen && (
        <ChangePasswordModal 
          onClose={() => setIsChangePasswordModalOpen(false)} 
          notify={notify} 
          profile={profile!}
        />
      )}
    </div>
  );
}

const ChangePasswordModal = ({ onClose, notify, profile }: { onClose: () => void, notify: (m: string, t?: 'success' | 'error' | 'info') => void, profile: UserProfile }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        await logActivity(profile, 'PASSWORD_CHANGE', 'Usuário alterou sua própria senha');
        notify('Senha alterada com sucesso.', 'success');
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-neutral-900 p-6 text-white">
          <h3 className="text-xl font-bold">Alterar Senha</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nova Senha</label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Confirmar Nova Senha</label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Dashboard Component ---

const Dashboard = ({ profile, notify, releasedPeriods }: { 
  profile: UserProfile, 
  notify: (m: string, t?: 'success' | 'error' | 'info') => void,
  releasedPeriods: ReleasedPeriod[]
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Booking | null>(null);

  useEffect(() => {
    const qRooms = query(collection(db, 'rooms'), orderBy('name'));
    const unsubscribeRooms = onSnapshot(qRooms, (snap) => {
      setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    });

    const qMyBookings = query(
      collection(db, 'bookings'), 
      where('userId', '==', profile.uid),
      orderBy('date', 'desc'),
      orderBy('startTime', 'desc')
    );
    const unsubscribeBookings = onSnapshot(qMyBookings, (snap) => {
      setMyBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    });

    return () => {
      unsubscribeRooms();
      unsubscribeBookings();
    };
  }, [profile.uid]);

  const handleCancelBooking = async (booking: Booking) => {
    const bookingTime = parse(`${booking.date} ${booking.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const now = new Date();
    const diff = differenceInHours(bookingTime, now);

    if (diff < 24) {
      notify(`Não é possível cancelar. Faltam menos de 24h para o início (${format(bookingTime, "dd/MM 'às' HH:mm")}).`, 'error');
      return;
    }

    setConfirmDelete(booking);
  };

  const handleEditBooking = (booking: Booking) => {
    const bookingTime = parse(`${booking.date} ${booking.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const now = new Date();
    const diff = differenceInHours(bookingTime, now);

    if (diff < 24) {
      notify(`Não é possível alterar. Faltam menos de 24h para o início (${format(bookingTime, "dd/MM 'às' HH:mm")}).`, 'error');
      return;
    }

    const room = rooms.find(r => r.id === booking.roomId);
    if (room) {
      setSelectedRoom(room);
      setEditingBooking(booking);
      setIsBookingModalOpen(true);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'bookings', confirmDelete.id));
      await logActivity(profile, 'BOOKING_CANCEL', `Agendamento cancelado: ${confirmDelete.roomName} em ${format(parse(confirmDelete.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')} ${confirmDelete.startTime}-${confirmDelete.endTime}`);
      notify('Agendamento cancelado com sucesso.', 'success');
    } catch (error) {
      notify('Erro ao cancelar agendamento.', 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <section>
        <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
          <DoorOpen className="w-6 h-6 text-blue-600" />
          Salas Disponíveis
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <motion.div 
              key={room.id}
              whileHover={{ y: -4 }}
              className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-neutral-900">{room.name}</h3>
                <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {room.capacity}
                </span>
              </div>
              <p className="text-neutral-500 text-sm mb-6 line-clamp-2">{room.description}</p>
              <button 
                onClick={() => {
                  setSelectedRoom(room);
                  setIsBookingModalOpen(true);
                }}
                className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Novo Agendamento
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-600" />
          Meus Agendamentos
        </h2>
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Sala</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Horário</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {myBookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-neutral-900">{booking.roomName}</p>
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      {format(parse(booking.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-neutral-600">
                      <span className="bg-neutral-100 px-2 py-1 rounded text-sm font-medium">
                        {booking.startTime} - {booking.endTime}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleEditBooking(booking)}
                          className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleCancelBooking(booking)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Cancelar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {confirmDelete && (
        <ConfirmationModal 
          title="Cancelar Agendamento"
          message="Deseja realmente cancelar este agendamento? Esta ação não pode ser desfeita."
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {isBookingModalOpen && selectedRoom && (
        <BookingModal 
          room={selectedRoom} 
          profile={profile} 
          booking={editingBooking}
          releasedPeriods={releasedPeriods}
          onClose={() => {
            setIsBookingModalOpen(false);
            setEditingBooking(null);
          }} 
          notify={notify}
        />
      )}
    </motion.div>
  );
};

// --- Admin Panel Component ---

const AdminPanel = ({ profile, notify, releasedPeriods, initialTab = 'bookings' }: { 
  profile: UserProfile, 
  notify: (m: string, t?: 'success' | 'error' | 'info') => void,
  releasedPeriods: ReleasedPeriod[],
  initialTab?: 'bookings' | 'rooms' | 'users' | 'summary' | 'calendar' | 'periods' | 'usage' | 'logs'
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'rooms' | 'users' | 'summary' | 'calendar' | 'periods' | 'usage' | 'logs'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logFilter, setLogFilter] = useState<string>('');
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<Room | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'booking' | 'room' | 'user' | 'period', email?: string, month?: string, name?: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchLogs = async () => {
    console.log('Fetching logs...');
    setLogsLoading(true);
    try {
      const qLogs = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(qLogs);
      setActivityLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    } catch (error: any) {
      console.error('Error fetching logs:', error);
      if (error.message?.includes('insufficient permissions')) {
        notify('Erro de permissão ao carregar logs. Verifique se você é um administrador.', 'error');
      } else {
        notify('Erro ao carregar logs do sistema.', 'error');
      }
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    const qBookings = query(collection(db, 'bookings'), orderBy('date', 'desc'), orderBy('startTime', 'desc'));
    const unsubscribeBookings = onSnapshot(qBookings, (snap) => {
      setAllBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    });

    const qRooms = query(collection(db, 'rooms'), orderBy('name'));
    const unsubscribeRooms = onSnapshot(qRooms, (snap) => {
      setRooms(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    });

    const qUsers = query(collection(db, 'users'), orderBy('name'));
    const unsubscribeUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });

    if (activeTab === 'logs') {
      fetchLogs();
    }

    return () => {
      unsubscribeBookings();
      unsubscribeRooms();
      unsubscribeUsers();
    };
  }, [activeTab]);

  const handleDeleteBooking = (id: string) => {
    setConfirmDelete({ id, type: 'booking' });
  };

  const handleDeleteRoom = (room: Room) => {
    setConfirmDelete({ id: room.id, type: 'room', name: room.name });
  };

  const handleDeleteUser = (u: UserProfile) => {
    if (u.uid === profile.uid) {
      notify('Você não pode excluir seu próprio usuário.', 'error');
      return;
    }
    if (u.email === 'darmanio@gmail.com') {
      notify('Este usuário é protegido e não pode ser excluído.', 'error');
      return;
    }
    setConfirmDelete({ id: u.uid, type: 'user', email: u.email, name: u.name });
  };

  const handleReleasePeriod = async (month: string) => {
    if (!month) return;
    if (releasedPeriods.some(p => p.month === month)) {
      notify('Este período já está liberado.', 'info');
      return;
    }
    setConfirmDelete({ id: 'new', type: 'period', month });
  };

  const handleRemovePeriod = async (id: string, month: string) => {
    setConfirmDelete({ id, type: 'period', month });
  };

  const filteredLogs = activityLogs.filter(log => 
    log.userName.toLowerCase().includes(logFilter.toLowerCase()) ||
    log.action.toLowerCase().includes(logFilter.toLowerCase()) ||
    log.details.toLowerCase().includes(logFilter.toLowerCase())
  );

  const usageSummary = useMemo(() => {
    const summary: { [userId: string]: { name: string, totalHours: number } } = {};
    allBookings.forEach(b => {
      if (!summary[b.userId]) {
        summary[b.userId] = { name: b.userName, totalHours: 0 };
      }
      const start = parse(b.startTime, 'HH:mm', new Date());
      const end = parse(b.endTime, 'HH:mm', new Date());
      const hours = Math.abs(differenceInHours(end, start));
      summary[b.userId].totalHours += hours;
    });
    return Object.values(summary).sort((a, b) => b.totalHours - a.totalHours);
  }, [allBookings]);

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { id, type } = confirmDelete;
    try {
      if (type === 'booking') {
        const bookingToDelete = allBookings.find(b => b.id === id);
        await deleteDoc(doc(db, 'bookings', id));
        if (bookingToDelete) {
          await logActivity(profile, 'BOOKING_DELETE_ADMIN', `Agendamento excluído pelo admin: ${bookingToDelete.roomName} de ${bookingToDelete.userName} em ${format(parse(bookingToDelete.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')} ${bookingToDelete.startTime}-${bookingToDelete.endTime}`);
        } else {
          await logActivity(profile, 'BOOKING_DELETE_ADMIN', `Agendamento excluído pelo admin: ID ${id}`);
        }
        notify('Agendamento excluído com sucesso.', 'success');
      } else if (type === 'room') {
        await deleteDoc(doc(db, 'rooms', id));
        await logActivity(profile, 'ROOM_DELETE', `Sala excluída: ${confirmDelete.name || id}`);
        notify('Sala excluída com sucesso.', 'success');
      } else if (type === 'user') {
        await deleteDoc(doc(db, 'users', id));
        await logActivity(profile, 'USER_DELETE', `Usuário excluído: ${confirmDelete.name || confirmDelete.email || id}`);
        notify('Usuário excluído com sucesso.', 'success');
      } else if (type === 'period') {
        if (id === 'new' && confirmDelete.month) {
          await addDoc(collection(db, 'releasedPeriods'), {
            month: confirmDelete.month,
            releasedBy: profile.uid,
            releasedAt: Timestamp.now()
          });
          await logActivity(profile, 'PERIOD_RELEASE', `Período liberado: ${confirmDelete.month}`);
          notify('Período liberado com sucesso.', 'success');
        } else {
          await deleteDoc(doc(db, 'releasedPeriods', id));
          await logActivity(profile, 'PERIOD_REMOVE', `Período removido: ${confirmDelete.month}`);
          notify('Período removido com sucesso.', 'success');
        }
      }
    } catch (error) {
      notify('Erro ao excluir item.', 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  const calculateStats = (roomId: string) => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const roomBookings = allBookings.filter(b => b.roomId === roomId);

    const getAllocatedSlots = (bookings: Booking[]) => {
      return bookings.reduce((acc, b) => {
        const start = parseInt(b.startTime.split(':')[0]);
        const end = parseInt(b.endTime.split(':')[0]);
        return acc + (end - start);
      }, 0);
    };

    const totalDailySlots = 11; 
    const totalWeeklySlots = totalDailySlots * 7;
    const totalMonthlySlots = totalDailySlots * 30;

    const todayBookings = roomBookings.filter(b => b.date === today);
    const weekBookings = roomBookings.filter(b => {
      const d = parse(b.date, 'yyyy-MM-dd', new Date());
      return d >= weekStart && d <= weekEnd;
    });
    const monthBookings = roomBookings.filter(b => {
      const d = parse(b.date, 'yyyy-MM-dd', new Date());
      return d >= monthStart && d <= monthEnd;
    });

    const allocatedToday = getAllocatedSlots(todayBookings);
    const allocatedWeek = getAllocatedSlots(weekBookings);
    const allocatedMonth = getAllocatedSlots(monthBookings);

    return {
      today: { allocated: allocatedToday, unallocated: Math.max(0, totalDailySlots - allocatedToday) },
      week: { allocated: allocatedWeek, unallocated: Math.max(0, totalWeeklySlots - allocatedWeek) },
      month: { allocated: allocatedMonth, unallocated: Math.max(0, totalMonthlySlots - allocatedMonth) }
    };
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          Painel Administrativo
        </h2>
        
        <div className="flex bg-white p-1 rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'bookings' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            Agendamentos
          </button>
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'rooms' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <DoorOpen className="w-4 h-4" />
            Salas
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'users' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
          <button 
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'summary' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <Info className="w-4 h-4" />
            Resumo
          </button>
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'calendar' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <CalendarIcon className="w-4 h-4" />
            Calendário
          </button>
          <button 
            onClick={() => setActiveTab('periods')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'periods' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <Clock className="w-4 h-4" />
            Períodos
          </button>
          <button 
            onClick={() => setActiveTab('usage')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'usage' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <Users className="w-4 h-4" />
            Uso por Usuário
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'logs' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'}`}
          >
            <Info className="w-4 h-4" />
            Logs
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {activeTab === 'bookings' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Sala</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Data/Hora</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {allBookings.map(booking => (
                  <tr key={booking.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-neutral-900">{booking.userName}</p>
                    </td>
                    <td className="px-6 py-4 text-neutral-600">{booking.roomName}</td>
                    <td className="px-6 py-4 text-neutral-600">
                      <div className="flex flex-col">
                        <span className="font-medium">{format(parse(booking.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</span>
                        <span className="text-xs text-neutral-400">{booking.startTime} - {booking.endTime}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => {
                          const room = rooms.find(r => r.id === booking.roomId);
                          if (room) {
                            setSelectedRoomForBooking(room);
                            setEditingBooking(booking);
                            setIsBookingModalOpen(true);
                          }
                        }}
                        className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteBooking(booking.id)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div>
            <div className="p-4 border-b border-neutral-200 flex justify-end">
              <button 
                onClick={() => {
                  setEditingRoom(null);
                  setIsRoomModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Sala
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Capacidade</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {rooms.map(room => (
                    <tr key={room.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-neutral-900">{room.name}</td>
                      <td className="px-6 py-4 text-neutral-600">{room.capacity} pessoas</td>
                      <td className="px-6 py-4 text-neutral-600 text-sm max-w-xs truncate">{room.description}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => {
                            setEditingRoom(room);
                            setIsRoomModalOpen(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRoom(room)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="p-4 border-b border-neutral-200 flex justify-end">
              <button 
                onClick={() => {
                  setEditingUser(null);
                  setIsUserModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Usuário
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Nome</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">E-mail</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Papel</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {users.map(u => (
                    <tr key={u.uid} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-neutral-900">{u.name}</td>
                      <td className="px-6 py-4 text-neutral-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-neutral-100 text-neutral-600'}`}>
                          {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => {
                            setEditingUser(u);
                            setIsUserModalOpen(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        {u.uid !== profile.uid && (
                          <button 
                            onClick={() => handleDeleteUser(u)}
                            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Sala</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Hoje (Aloc/Desaloc)</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Semana (Aloc/Desaloc)</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Mês (Aloc/Desaloc)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {rooms.map(room => {
                  const stats = calculateStats(room.id);
                  return (
                    <tr key={room.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-neutral-900">{room.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 font-bold">{stats.today.allocated}h</span>
                          <span className="text-neutral-300">/</span>
                          <span className="text-neutral-500">{stats.today.unallocated}h</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 font-bold">{stats.week.allocated}h</span>
                          <span className="text-neutral-300">/</span>
                          <span className="text-neutral-500">{stats.week.unallocated}h</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600 font-bold">{stats.month.allocated}h</span>
                          <span className="text-neutral-300">/</span>
                          <span className="text-neutral-500">{stats.month.unallocated}h</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="p-6">
            <CalendarView bookings={allBookings} rooms={rooms} />
          </div>
        )}

        {activeTab === 'periods' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Liberar Novo Mês</label>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <button 
                onClick={() => {
                  if (selectedMonth) {
                    handleReleasePeriod(selectedMonth);
                    setSelectedMonth('');
                  } else {
                    notify('Selecione um mês para liberar.', 'info');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors h-[50px]"
              >
                <Plus className="w-5 h-5" />
                Liberar Mês
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {releasedPeriods.sort((a, b) => b.month.localeCompare(a.month)).map(p => (
                <div key={p.id} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 flex justify-between items-center group">
                  <div>
                    <p className="font-bold text-neutral-900">{format(parse(p.month, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: ptBR })}</p>
                    <p className="text-xs text-neutral-500">Liberado em {format(p.releasedAt.toDate(), 'dd/MM/yyyy')}</p>
                  </div>
                  <button 
                    onClick={() => handleRemovePeriod(p.id, p.month)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {releasedPeriods.length === 0 && (
                <div className="col-span-full py-12 text-center text-neutral-500">
                  Nenhum período liberado. Usuários não poderão realizar agendamentos.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Usuário</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Total de Horas</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Estimativa de Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {usageSummary.map(u => (
                  <tr key={u.name} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-neutral-900">{u.name}</td>
                    <td className="px-6 py-4 text-neutral-600 font-mono">{u.totalHours}h</td>
                    <td className="px-6 py-4 text-neutral-600">R$ {(u.totalHours * 50).toFixed(2)} <span className="text-xs text-neutral-400">(Base: R$50/h)</span></td>
                  </tr>
                ))}
                {usageSummary.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-neutral-500">Nenhum dado de uso disponível.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-4 p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                  type="text"
                  placeholder="Filtrar logs por usuário, ação ou detalhes..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <button 
                onClick={fetchLogs}
                disabled={logsLoading}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                Atualizar Logs
              </button>
            </div>
            <div className="overflow-x-auto border rounded-xl">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Data/Hora</th>
                    <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Ação</th>
                    <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-neutral-50 transition-colors text-sm">
                      <td className="px-6 py-3 text-neutral-500 whitespace-nowrap">{format(log.timestamp.toDate(), 'dd/MM/yy HH:mm:ss')}</td>
                      <td className="px-6 py-3 font-semibold text-neutral-900">{log.userName}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          log.action === 'LOGIN' ? 'bg-green-100 text-green-700' :
                          log.action === 'LOGOUT' ? 'bg-neutral-100 text-neutral-600' :
                          log.action === 'BOOKING_CREATE' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-neutral-600">{log.details}</td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">Nenhum log encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmationModal 
          title={
            confirmDelete.type === 'booking' ? 'Excluir Agendamento' : 
            confirmDelete.type === 'room' ? 'Excluir Sala' : 
            confirmDelete.type === 'user' ? 'Excluir Usuário' : 
            confirmDelete.id === 'new' ? 'Liberar Período' : 'Remover Período'
          }
          message={
            confirmDelete.type === 'period' 
              ? `Deseja realmente ${confirmDelete.id === 'new' ? 'liberar' : 'remover'} o período de ${confirmDelete.month ? format(parse(confirmDelete.month, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: ptBR }) : ''}?` :
            confirmDelete.type === 'booking' ? 'Excluir este agendamento permanentemente?' :
            confirmDelete.type === 'room' ? 'Excluir esta sala? Isso não apagará os agendamentos vinculados, mas impedirá novos.' :
            `Excluir o usuário ${confirmDelete.email}?`
          }
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {isRoomModalOpen && (
        <RoomModal 
          room={editingRoom} 
          profile={profile}
          onClose={() => setIsRoomModalOpen(false)} 
          notify={notify}
        />
      )}

      {isUserModalOpen && (
        <UserModal 
          user={editingUser} 
          profile={profile}
          onClose={() => setIsUserModalOpen(false)} 
          notify={notify}
        />
      )}

      {isBookingModalOpen && selectedRoomForBooking && (
        <BookingModal 
          room={selectedRoomForBooking} 
          profile={profile} 
          booking={editingBooking}
          releasedPeriods={releasedPeriods}
          onClose={() => {
            setIsBookingModalOpen(false);
            setEditingBooking(null);
            setSelectedRoomForBooking(null);
          }} 
          notify={notify}
        />
      )}
    </motion.div>
  );
};

// --- Modals ---

const BookingModal = ({ room, profile, booking, releasedPeriods, onClose, notify }: { 
  room: Room, 
  profile: UserProfile, 
  booking?: Booking | null, 
  releasedPeriods: ReleasedPeriod[],
  onClose: () => void, 
  notify: (m: string, t?: 'success' | 'error' | 'info') => void 
}) => {
  const [date, setDate] = useState(booking?.date || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(booking?.startTime || '09:00');
  const [endTime, setEndTime] = useState(booking?.endTime || '10:00');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);

  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = i + 8;
    return `${h.toString().padStart(2, '0')}:00`;
  });

  useEffect(() => {
    const q = query(
      collection(db, 'bookings'),
      where('roomId', '==', room.id),
      where('date', '==', date)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setDayBookings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));
    });
    return () => unsubscribe();
  }, [room.id, date]);

  const checkConflict = async (checkDate: string) => {
    // If it's the current date being viewed, we can use dayBookings state
    const existingBookings = (checkDate === date ? dayBookings : await (async () => {
      const q = query(
        collection(db, 'bookings'),
        where('roomId', '==', room.id),
        where('date', '==', checkDate)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    })()).filter(b => b.id !== booking?.id);

    const newInterval = {
      start: parse(`${checkDate} ${startTime}`, 'yyyy-MM-dd HH:mm', new Date()),
      end: parse(`${checkDate} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date())
    };

    return existingBookings.some(b => {
      const existingInterval = {
        start: parse(`${b.date} ${b.startTime}`, 'yyyy-MM-dd HH:mm', new Date()),
        end: parse(`${b.date} ${b.endTime}`, 'yyyy-MM-dd HH:mm', new Date())
      };
      return areIntervalsOverlapping(newInterval, existingInterval);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (startTime >= endTime) {
      setError('Horário de término deve ser após o início.');
      return;
    }

    if (booking && profile.role !== 'admin') {
      const originalTime = parse(`${booking.date} ${booking.startTime}`, 'yyyy-MM-dd HH:mm', new Date());
      const now = new Date();
      if (differenceInHours(originalTime, now) < 24) {
        setError(`Não é possível alterar. Faltam menos de 24h para o início (${format(originalTime, "dd/MM 'às' HH:mm")}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const releasedMonths = releasedPeriods.map(p => p.month);

      const datesToBook: string[] = [];
      const baseDate = parse(date, 'yyyy-MM-dd', new Date());
      const count = recurrence === 'none' ? 1 : recurrenceCount;

      for (let i = 0; i < count; i++) {
        let nextDate: Date;
        if (recurrence === 'daily') {
          nextDate = addDays(baseDate, i);
        } else if (recurrence === 'weekly') {
          nextDate = addDays(baseDate, i * 7);
        } else {
          nextDate = baseDate;
        }
        
        const monthStr = format(nextDate, 'yyyy-MM');
        if (profile.role !== 'admin' && !releasedMonths.includes(monthStr)) {
          setError(`O período ${format(nextDate, 'MMMM yyyy', { locale: ptBR })} não está liberado para agendamentos.`);
          setLoading(false);
          return;
        }
        
        datesToBook.push(format(nextDate, 'yyyy-MM-dd'));
      }

      // Check conflicts for all dates
      for (const d of datesToBook) {
        const hasConflict = await checkConflict(d);
        if (hasConflict) {
          setError(`Conflito de horário na data ${format(parse(d, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}.`);
          setLoading(false);
          return;
        }
      }

      if (booking) {
        await updateDoc(doc(db, 'bookings', booking.id), {
          date,
          startTime,
          endTime
        });
        await logActivity(profile, 'BOOKING_UPDATE', `Agendamento atualizado: ${room.name} em ${format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')} ${startTime}-${endTime}`);
        notify('Agendamento atualizado com sucesso.', 'success');
      } else {
        const batch = datesToBook.map(d => addDoc(collection(db, 'bookings'), {
          userId: profile.uid,
          userName: profile.name,
          roomId: room.id,
          roomName: room.name,
          date: d,
          startTime,
          endTime,
          createdAt: Timestamp.now()
        }));
        await Promise.all(batch);
        await logActivity(profile, 'BOOKING_CREATE', `Agendamento realizado: ${room.name} em ${datesToBook.length} data(s)`);
        notify(datesToBook.length > 1 ? 'Agendamentos recorrentes realizados com sucesso.' : 'Agendamento realizado com sucesso.', 'success');
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
      >
        {/* Left Side: Form */}
        <div className="flex-1 overflow-y-auto border-r border-neutral-100">
          <div className="bg-neutral-900 p-6 text-white flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold">{booking ? 'Editar Agendamento' : `Agendar ${room.name}`}</h3>
              <p className="text-neutral-400 text-sm">Preencha os detalhes da reserva</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors md:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Data</label>
              <input 
                type="date" 
                required
                min={format(new Date(), 'yyyy-MM-dd')}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Início</label>
                <select 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hours.slice(0, -1).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Término</label>
                <select 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hours.slice(1).map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            {!booking && (
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-neutral-700">Recorrência</label>
                  <div className="flex bg-neutral-100 p-1 rounded-lg">
                    {(['none', 'daily', 'weekly'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRecurrence(type)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          recurrence === type ? 'bg-white text-blue-600 shadow-sm' : 'text-neutral-500'
                        }`}
                      >
                        {type === 'none' ? 'Nenhuma' : type === 'daily' ? 'Diária' : 'Semanal'}
                      </button>
                    ))}
                  </div>
                </div>

                {recurrence !== 'none' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-neutral-500 uppercase">Número de Ocorrências</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="30"
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                    <p className="text-[10px] text-neutral-400 italic">Máximo de 30 ocorrências por vez.</p>
                  </motion.div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-6">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-neutral-300 rounded-xl font-bold text-neutral-700 hover:bg-neutral-50 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (booking ? 'Atualizar' : 'Confirmar')}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Availability */}
        <div className="w-full md:w-80 bg-neutral-50 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-neutral-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Disponibilidade
            </h4>
            <button onClick={onClose} className="hidden md:block p-1 hover:bg-neutral-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">
              {format(parse(date, 'yyyy-MM-dd', new Date()), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>

            <div className="space-y-1">
              {hours.map((h, idx) => {
                const isOccupied = dayBookings.some(b => {
                  const bStart = parseInt(b.startTime.split(':')[0]);
                  const bEnd = parseInt(b.endTime.split(':')[0]);
                  const currentH = parseInt(h.split(':')[0]);
                  return currentH >= bStart && currentH < bEnd && b.id !== booking?.id;
                });

                const isSelected = (() => {
                  const sStart = parseInt(startTime.split(':')[0]);
                  const sEnd = parseInt(endTime.split(':')[0]);
                  const currentH = parseInt(h.split(':')[0]);
                  return currentH >= sStart && currentH < sEnd;
                })();

                return (
                  <div 
                    key={h} 
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm transition-all ${
                      isOccupied 
                        ? 'bg-red-50 text-red-700 opacity-60' 
                        : isSelected 
                          ? 'bg-blue-100 text-blue-800 font-bold' 
                          : 'bg-white text-neutral-600 border border-neutral-100'
                    }`}
                  >
                    <span className="w-10 text-[10px] font-mono">{h}</span>
                    <div className="flex-1 h-2 rounded-full bg-current opacity-10" />
                    <span className="text-[10px] uppercase font-bold">
                      {isOccupied ? 'Ocupado' : isSelected ? 'Sua Reserva' : 'Livre'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[10px] text-blue-700 leading-relaxed">
              <strong>Dica:</strong> Verifique os horários em vermelho para evitar conflitos. O sistema não permite sobreposição de reservas.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const RoomModal = ({ room, profile, onClose, notify }: { room: Room | null, profile: UserProfile, onClose: () => void, notify: (m: string, t?: 'success' | 'error' | 'info') => void }) => {
  const [name, setName] = useState(room?.name || '');
  const [capacity, setCapacity] = useState(room?.capacity || 1);
  const [description, setDescription] = useState(room?.description || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (room) {
        await updateDoc(doc(db, 'rooms', room.id), { name, capacity: Number(capacity), description });
        await logActivity(profile, 'ROOM_UPDATE', `Sala atualizada: ${name}`);
        notify('Sala atualizada com sucesso.', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'rooms'), { name, capacity: Number(capacity), description });
        await logActivity(profile, 'ROOM_CREATE', `Sala criada: ${name} (ID: ${docRef.id})`);
        notify('Sala criada com sucesso.', 'success');
      }
      onClose();
    } catch (err) {
      console.error(err);
      notify('Erro ao salvar sala.', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-neutral-900 p-6 text-white">
          <h3 className="text-xl font-bold">{room ? 'Editar Sala' : 'Nova Sala'}</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nome da Sala</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Sala de Reunião A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Capacidade</label>
            <input 
              type="number" 
              required
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Descrição / Recursos</label>
            <textarea 
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
              placeholder="Ex: Projetor, Ar-condicionado, 10 cadeiras..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const UserModal = ({ user, profile, onClose, notify }: { user: UserProfile | null, profile: UserProfile, onClose: () => void, notify: (m: string, t?: 'success' | 'error' | 'info') => void }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<UserRole>(user?.role || 'user');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResetPassword = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // In a real app, we would send a password reset email.
      // But since we have secondaryAuth, we can't easily reset it without the user's current password.
      // However, we can use sendPasswordResetEmail.
      await sendPasswordResetEmail(auth, user.email);
      await logActivity(profile, 'PASSWORD_RESET_ADMIN', `Admin solicitou reset de senha para: ${user.email}`);
      notify('E-mail de redefinição de senha enviado com sucesso.', 'success');
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), { name, email, role });
        await logActivity(profile, 'USER_UPDATE', `Usuário atualizado: ${email} (${role})`);
        notify('Usuário atualizado com sucesso.', 'success');
      } else {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, email);
        const newUser = userCredential.user;
        
        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          name,
          email,
          role
        });
        
        await logActivity(profile, 'USER_CREATE', `Usuário criado: ${email} (${role})`);
        await signOut(secondaryAuth);
        notify('Usuário criado com sucesso. A senha padrão é o e-mail.', 'success');
      }
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Erro: O provedor de E-mail/Senha não está ativado no Firebase Console. Por favor, ative-o em Authentication > Sign-in method.');
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-neutral-900 p-6 text-white">
          <h3 className="text-xl font-bold">{user ? 'Editar Usuário' : 'Novo Usuário'}</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nome Completo</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Papel</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {user && (
            <div className="pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Enviar E-mail de Reset de Senha
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ConfirmationModal = ({ title, message, onConfirm, onCancel }: { title: string, message: string, onConfirm: () => void, onCancel: () => void }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
    >
      <div className="p-6">
        <h3 className="text-xl font-bold text-neutral-900 mb-2">{title}</h3>
        <p className="text-neutral-500 text-sm">{message}</p>
      </div>
      <div className="flex border-t border-neutral-100">
        <button 
          onClick={onCancel}
          className="flex-1 px-4 py-4 text-sm font-bold text-neutral-500 hover:bg-neutral-50 transition-colors"
        >
          Cancelar
        </button>
        <button 
          onClick={onConfirm}
          className="flex-1 px-4 py-4 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors border-l border-neutral-100"
        >
          Confirmar
        </button>
      </div>
    </motion.div>
  </div>
);
