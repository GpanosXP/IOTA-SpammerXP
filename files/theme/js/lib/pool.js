
function Pool()
{
    this.slots = []; // True means empty, false means occupied
    this.count = 0;
    this.occupied = 0;
    this.empty = 0;

    var occupyBacklog = new Queue();
    var emptySlotPromise;
    var emptySlotResolve;

    this.processBacklog = function()
    {
        while (this.empty) {
            const resolve = occupyBacklog.dequeue();
            if (!resolve) return fulfillEmptySlotPromise();

            resolve(this.occupyNow()); // resolve promise
        }
    };

    var fulfillEmptySlotPromise = function()
    {
        if (emptySlotPromise) {
            emptySlotPromise = undefined;
            emptySlotResolve();
        }
    };

    this.popLastSlots = function()
    {
        while (this.count < this.slots.length && this.slots[this.slots.length - 1]) this.slots.pop();
    };

    this.findEmpty = function()
    {
        for (var i = 0; i < this.count; i++) if (this.slots[i]) return i;
        return -1;
    };

    this.addSlots = function(count)
    {
        if (!(count && count > 0)) return false;

        var i = this.count;
        this.count += count;

        for (; i < this.slots.length; i++) if (this.slots[i]) this.empty++;
        for (; i < this.count; i++) {
            this.slots.push(true);
            this.empty++;
        }

        this.processBacklog();

        return true;
    };

    this.removeSlots = function(count)
    {
        if (!(count && count > 0)) return false;
        if (count > this.count) return false;

        var i = this.count - 1;
        this.count -= count;

        for (; i >= this.count; i--) if (this.slots[i]) this.empty--;

        this.popLastSlots();

        return true;
    };

    this.occupyNow = function()
    {
        if (!this.empty) return -1;

        const id = this.findEmpty();
        if (id < 0) return -1;

        this.slots[id] = false;
        this.occupied++;
        this.empty--;

        return id;
    };

    this.occupy = function()
    {
        const id = this.occupyNow();
        if (id >= 0) return Promise.resolve(id);
        else return new Promise((resolve, reject) => { occupyBacklog.enqueue(resolve); });
    };

    this.free = function(id)
    {
        if (!(id >= 0 && id < this.slots.length)) return false;

        this.slots[id] = true;
        this.occupied--;

        this.popLastSlots();

        if (id < this.count) {
            this.empty++;
            this.processBacklog();
        }
    };

    this.notify = function()
    {
        if (this.empty) return Promise.resolve();

        if (emptySlotPromise) return emptySlotPromise;

        emptySlotPromise = new Promise((resolve, reject) => { emptySlotResolve = resolve; });

        return emptySlotPromise;
    };
}
