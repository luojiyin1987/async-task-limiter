import { extname } from "path";

export class PipLimit {
    private tasks: (() => void)[] = [];
    count: number;

    constructor(count: number) {
        this.count = count;
    }

    private schedule() {
        if (this.count > 0 && this.tasks.length > 0) {
            this.count--;
            let next = this.tasks.shift();
            if (next === undefined) {
                throw new Error("Unexpected undefined value in tasks list");
            }
            next();
        }
    }

    public acquire(): Promise<() => void> {
        return new Promise<() => void>((res, rej) => {
            const task = () => {
                let released = false;
                res(() => {
                    if (!released) {
                        released = true;
                        this.count++;
                        this.schedule();
                    }
                });
            }

            this.tasks.push(task);
            if (process && process.nextTick) {
                process.nextTick(this.schedule.bind(this))
            } else {
                setImmediate(this.schedule.bind(this));
            }
        });
    }

    public use<T>(f: () => Promise<T>): Promise<T> {
        return this.acquire()
            .then(release => {
                return f()
                    .then((res) => {
                        release();
                        return res;
                    })
                    .catch((err) => {
                        release();
                        throw err;
                    })

            })
    }
}

export class Mutex extends PipLimit {
    constructor() {
        super(1);
    }
}
