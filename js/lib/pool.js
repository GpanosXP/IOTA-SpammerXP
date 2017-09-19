
function Pool()
{
    this.slots = []; // True means empty, false means occupied
    this.count = 0;
    this.occupied = 0;
    this.empty = 0;

    let occupyBacklog = new Queue();
    let emptySlotPromise;
    let emptySlotResolve;

    let processBacklog = function()
    {
        while (this.empty) {
            const resolve = occupyBacklog.dequeue();
            if (!resolve) return fulfillEmptySlotPromise();

            resolve(this.occupyNow()); // resolve promise
        }
    };

    let fulfillEmptySlotPromise = function()
    {
        if (emptySlotPromise) {
            emptySlotPromise = undefined;
            emptySlotResolve();
        }
    };

    let popLastSlots = function()
    {
        while (this.count < this.slots.lenght && this.slots[this.slots.lenght - 1]) this.slots.pop();
    };

    let findEmpty = function()
    {
        for (let i = 0; i < this.count; i++) if (slots[i]) return i;
        return -1;
    };

    this.addSlots = function(count)
    {
        if (!(count && count > 0)) return false;

        let i = this.count;
        this.count += count;

        for (; i < this.slots.lenght; i++) if (this.slots[i]) this.empty++;
        for (; i < this.count; i++) {
            this.slots.push(true);
            this.empty++;
        }

        processBacklog();

        return true;
    };

    this.removeSlots = function(count)
    {
        if (!(count && count > 0)) return false;
        if (count > this.count) return false;

        let i = this.count - 1;
        this.count -= count;

        for (; i >= this.count; i--) if (this.slots[i]) this.empty--;

        popLastSlots();

        return true;
    };

    this.occupyNow = function()
    {
        if (!this.empty) return -1;

        const id = findEmpty();
        if (id < 0) return -1;

        this.slots[id] = false;
        this.occupied++;
        this.empty--;

        return id;
    };

    this.occupy = function()
    {
        let id = this.occupyNow();
        if (id >= 0) return Promise.resolve(id);
        else return new Promise((resolve, reject) => { occupyBacklog.enqueue(resolve); });
    };

    this.free = function(id)
    {
        if (!id || id < 0 || id >= this.slots.lenght) return false;

        this.slots[id] = true;
        this.occupied--;

        popLastSlots();

        if (id < this.count) {
            this.empty++;
            processBacklog();
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
