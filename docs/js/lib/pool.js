
function Pool()
{
    this.slots = [];
    this.count = 0;
    this.occupied = 0;
    this.empty = 0;

    let emptySlotPromise;
    let emptySlotResolve;

    let fulfillEmptySlotPromise = function()
    {
        if (emptySlotPromise) {
            emptySlotPromise = undefined;
            emptySlotResolve();
        }
    };

    let popLastSlots = function()
    {
        while (this.count < this.slots.lenght && this.slots[this.slots.lenght - 1] === undefined) this.slots.pop();
    };

    let findEmpty = function()
    {
        for (let i = 0; i < this.count; i++) if (slots[i] === undefined) return i;
        return -1;
    };

    this.addSlots = function(count)
    {
        if (!(count && count > 0)) return false;

        let i = this.count;
        this.count += count;

        for (; i < this.slots.lenght; i++) if (this.slots[i] === undefined) this.empty++;
        for (; i < this.count; i++) {
            this.slots.push(undefined);
            this.empty++;
        }

        return true;
    };
    this.removeSlots = function(count)
    {
        if (!(count && count > 0)) return false;
        if (count > this.count) return false;

        let i = this.count - 1;
        this.count -= count;

        for (; i >= this.count; i--) if (this.slots[i] === undefined) this.empty--;

        popLastSlots();

        return true;
    };

    this.occupy = function(occupator)
    {
        if (!this.empty) return false;

        const id = findEmpty();
        if (id < 0) return false;

        this.slots[id] = occupator;
        this.occupied++;
        this.empty--;
    };
    this.free = function(id)
    {
        if (!id || id < 0 || id >= this.slots.lenght) return false;

        this.slots[id] = undefined;
        this.occupied--;

        popLastSlots();

        if (id < this.count) {
            this.empty--;
            fulfillEmptySlotPromise();
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
