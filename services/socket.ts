import { io, type Socket } from 'socket.io-client';

// Android Emulator: 10.0.2.2 points to the computer running the server.
// Physical phone: replace this with the computer's Wi-Fi IP.
export const SERVER_URL = 'http://10.0.2.2:3000';

export type Message = {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  createdAt: string;
};

type Result = { ok: boolean; error?: string };
type ServerEvents = {
  receive_message: (message: Message) => void;
  user_joined: (user: { name: string }) => void;
};
type ClientEvents = {
  user_join: (user: { name: string }, reply: (result: Result) => void) => void;
  send_message: (
    message: { text: string },
    reply: (result: Result) => void,
  ) => void;
};

// Connect only when GroupScreen opens.
export const socket: Socket<ServerEvents, ClientEvents> = io(SERVER_URL, {
  autoConnect: false,
});
