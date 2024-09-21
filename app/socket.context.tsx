import {
    type ReactNode,
    createContext,
    useContext,
    useEffect,
    useRef,
    useState
} from "react";
import { type Socket, io } from "socket.io-client";
import { useEnv, useOptionalUser } from "./root";


const context = createContext<{
    socket: Socket | null
}>({ socket: null });

export function useSocket() {
    if (!context) {
        throw new Error("Please use 'SocketProvider' to wrap your component.");
    }
    return useContext(context);
}

export function SocketProvider({ children }: { children: ReactNode }) {
    const socketRef = useRef<Socket | null>(null);
    const env = useEnv()
    const user = useOptionalUser();
    const [isSocketConnected, setIsSocketConnected] = useState(false)
    useEffect(() => {
        if (!user?.token) return;
        socketRef.current = io(env?.STRAPI_URL || '', {
            reconnection: true,
            reconnectionDelay: 150,
            reconnectionAttempts: Number.POSITIVE_INFINITY,
            query: {
                token: user?.token || ''

            }
        });
        const socket = socketRef.current;
        if (!socket) return;

        socket.emit("connection");

        const handleConnect = () => {
            setIsSocketConnected(true);
        }
        const handleDisconnect = () => {
            setIsSocketConnected(false);
        }

        socket.on('confirmation', handleConnect)
        socket.on('disconnect', handleDisconnect)
        console.log(`Should emit connection event to ${env?.STRAPI_URL}`)
        return () => {
            socket.off('confirmation', handleConnect)
            socket.off('disconnect', handleDisconnect)
            socket.disconnect();
        }

    }, [env?.STRAPI_URL, user?.token]);

    return (
        <context.Provider value={{ socket: socketRef.current }}>
            <div className="absolute top-8 left-4">
                {isSocketConnected ? <span>✅</span> : <span>🚨</span>}
            </div>
            {children}
        </context.Provider>
    );
}
