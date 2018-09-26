export default class Spinner {

	private delay: number;
	private lastTick: number = Date.now();
	private currentTick: number = 0;

	constructor(delay: number) {
		this.delay = delay;
	}

	tick() {
		if(this.lastTick < Date.now() - this.delay) return;
		this.currentTick = this.currentTick + 1 % 7;
		this.lastTick = Date.now();
	}

	toString() {
		switch(this.currentTick) {
			case 0:
			case 4: return '|';
			case 1:
			case 5: return '/';
			case 2:
			case 6: return '-';
			case 7:
			case 3: return '\\';
			default: return '*';
		}
	}

}