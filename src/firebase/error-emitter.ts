import { EventEmitter } from 'events';

class FirebaseErrorEmitter extends EventEmitter {}

export const errorEmitter = new FirebaseErrorEmitter();
