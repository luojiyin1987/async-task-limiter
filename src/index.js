const EventEmitter =  require('events');

function hasOwnProperty(obj, prop)  {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

class pipLimit  extends  EventEmitter {
    constructor(limit, options) {
        super();
        this.limit = limit;
        this.active = 0;
        this.queue = [];
        this.options = {
            disabled: false,
            refuse: false,
            ratio: 1,
            timeout: null
        };
         
        if(typeof options === 'boolean') {
            options ={
                disabled: options
            }
        }
        
        for (const key in this.options) {
            if (hasOwnProperty(options, key)) {
                this.options[key] = options[key];
            }
        }

        this.queueLength = Math.round(this.limit * (this.options.ratio || 1));
    }

    push(method, ...args) {
        if(typeof args[args.length - 1] !== 'function') {
            args.push(function() {})
        }
        
        const callback = args[args.length - 1];
        
        if(this.options.disabled || this.limit <1) {
            method(...args);
            return this
        }

        if (this.queue.length < this.queueLength || !this.options.refuse) {
            this.queue.push({
                method,
                args: args
            })
        } else {
            const err = new Error('Too much async calls in queue');
            err.name = 'TooMuchAsyncCalls';
            callback(err);
        }

        if(this.queue.length >1) {
            this.emit('push', this.queue.length);
        }

        this.next();
        return this;
    }

    next() {
        if(this.active >= this.limit || this.queue.length === 0) {
            return;
        }

        const {method, args} = this.queue.shift();
        this.active++;

        const callback = args[args.length -1];
        let timer = null;
        let called = false;

        args[args.length -1] =(err, ...rest)=> {
            if(timer) {
                clearTimeout(timer);
                timer = null;
            }

            if(!called) {
                this._next();
                callback(err, ...rest);
            } else {
                if(err) {
                    this.emit('outdated', err)
                }
            }
        };
        
        const timout  = this.options.timeout;
        if(timeout) {
            timer = setTimeout(() => {
                called = true;
                this._next();
                const err = new Error(timeout + 'ms timeout');
                err.name = 'Timeout';
                err.data = {
                    name: method.name,
                    method: method.toString(),
                    args: args.slice(0, args.length - 1)
                };
                callback(err);
            }, timeout);
        }

        method(...args);
    }

    _next() {
        this.active--;
        this.next();
    }

}

module.exports = pipLimit;