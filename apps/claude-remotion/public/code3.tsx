// 1.8s minimum, plus 0.07s per character. This is the rule the
// caption layer and every plan validator share.
const readingFloor = (text: string) =>
	Math.max(1.8, text.length * 0.07);

readingFloor("Cuts land on the beat.");
//  ^?
