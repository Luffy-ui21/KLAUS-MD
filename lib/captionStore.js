import { getBotName } from './botname.js';

const captions = new Map();

export function getUserCaption(userId) {
  return captions.get(userId) || `${getBotName()} is the Alpha`;
}

export function setUserCaption(userId, caption) {
  captions.set(userId, caption);
}

export function getUserCaptionMap() {
  return captions;
}
