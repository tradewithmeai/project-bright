// A caption has to be on screen long enough to be READ.
const readingFloor = (text: string) => text.length * 0.07;

readingFloor("Cuts land on the beat.");
//  ^?
