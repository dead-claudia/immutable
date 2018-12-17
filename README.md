# Immutable

A simple, concise, and flexible immutable manipulation library. It's heavily inspired by lenses, but it avoids some of their restrictiveness.

**NOTE:** This is probably completely and horribly broken, and it's wholly untested and incredibly incomplete. Don't use this in production.

### Installation

Pretty simple:

```
npm install --save isiahmeadows/immutable
yarn add github:isiahmeadows/immutable
```

### Export format

Each of these are available under `immutable`:

- `immutable/core`, re-exported directly
- `immutable/async`, re-exported under the namespace `A`

### Core methods and views

These are available via `immutable/core`

- `create(view): newObject` - Returns `view.create()`
- `get(object, view): value` - Returns `view.get(object)`
- `set(object, view, value): newObject` - Returns `view.set(object, value)`
- `update(object, view, func): newObject` - Returns `view.update(object, func)` or `view.set(object, func(view.get(object)))`
- `has(object, view): boolean` - Returns `view.has(object)`, coerced to a boolean
- `remove(object, view): newObject` - Returns `view.remove(object)`
- `i(object): wrapper` - Wraps an object for sync manipulation using the above methods

Wrappers have various methods that mirror core methods, plus a couple to get the unwrapped value:

- `wrapper.get(view)` - Same as `i(get(wrapper.object, view))`
- `wrapper.set(view, value)` - Same as `i(set(wrapper.object, view, value))`
- `wrapper.update(view, func)` - Same as `i(update(wrapper.object, view, func))`
- `wrapper.has(view)` - Same as `has(wrapper.object, view)`
- `wrapper.remove(view)` - Same as `i(remove(wrapper.object, view))`
- `wrapper.value` and `wrapper.valueOf()` get the underlying value out of the wrapper.

There are also a couple core view factories, which exist for two reasons:

1. They are *very* broadly useful.
2. They enable certain common forms of composition.

- `c(...views)` - Compose multiple views into one nested view
- `p({...keys})` - Split and join multiple views based on object keys

Here's how each of these work:

- `c(...views)` proxy all their operations through `views`.
    - `create` uses `create` and `update` to create a composed view.
    - `get` recurses through `get`, returning `undefined` if any returns `null`/`undefined`.
    - `set` works identically to `update` with a thunk returning the value to set, but with preference for `set` at the last step.
    - `update` recurses through `update` (falling back to `get` + `set` pairs) to eventually update the value.
    - `has` recurses through `get` for all but the last view, in which it calls `has`. If any `get` returns `null`/`undefined`, it returns `false` and aborts recursion.
    - `remove` recurses through `update` for all but the last view, in which it calls `remove`.
    - For two special cases:
        - `c()` returns `undefined`
        - `c(view)` returns `view` directly

- `p({...keys})` split and join all their operations through the views in `keys`.
    - `create` returns an object with each key set to the result of `create`ing their respective views.
    - `get` returns an object where each `key` of `keys` is read from `object` and run through the corresponding view's `get`.
    - `set` returns a copy of `object` where each `key` of `keys` is updated via `set`.
    - `update` is not implemented, to delegate to the fallback of `get` + `set`.
    - `has` calls `has` on every key's view and returns `true` if any return `true`, `false` otherwise.
    - `remove` calls `remove` on each key's view.

### Views

This uses views to control how to read and write values. They take three forms:

- A single `{create, get, set, update, has, remove}` object:
    - `v.create() -> newObject` creates a new empty instance.
    - `v.get(object) -> value` gets the underlying value of the view.
    - `v.set(object, value) -> newObject` sets the underlying value in a new clone
    - `v.update(object, func) -> newObject` is a fused `v.set(object, func(v.get(object)))`, in case this can be more efficiently optimized.
    - `v.has(object) -> boolean` tests if the view exists on an object.
    - `v.remove(object) -> newObject` removes the view from an object.
    - All methods are optional, and need not be own.
    - Invariants:
        - `object` could be `null`/`undefined` in `set` and `update`, but in nothing else.
        - `func` in `v.update(object, func)` may be called any number of times - it's not restricted to just one call.
        - If both `v.set(object, value)` and `v.update(object, func)` are present, `v.set(object, value)` must have the same effect as `v.update(object, () => value)`.
    - As a general rule of thumb, `v.update(object, func)` should be equivalent to `v.set(object, func(v.get(object)))` unless the view is a cursor over multiple items.

- Property keys:
    - `create` returns `[]` if `view` is an integer index, `{}` otherwise.
    - `get` returns `object[view]`
    - `set` returns `Object.assign(object.slice(), {[view]: value})` if `view` is an integer index, `{...object, [view]: value}` otherwise.
    - `has` returns `view in object`
    - `remove` returns `o` in `let o = object.slice(); o.splice(view, 1)` if `view` is an integer index, `o` in `let o = {...object}; delete o[view]` otherwise.
    - Note: integer indices are `value`s where `typeof value === "number" && value % 1 === 0 && 1 / value === Infinity && value <= Number.MAX_SAFE_INTEGER`

- `null`/`undefined`:
    - `create` returns `undefined`
    - `get` returns `object`.
    - `set` returns `value`.
    - `has` returns `true`.
    - `remove` returns `object`.
    - Note: this functions more or less as the "self" view.

If you're from a functional programming background, you're probably thinking that the view object variant looks a *lot* like a lens, and you would be right - it's functionally a superset (all you'd need is a `{get, set}` pair to emulate one). There's three primary differences here:

- `get` and `set` don't both need to exist - you can have just a `get` or just a `set` and it still work. With lenses, this is not the case.
- You can manipulate nested entries as if they were individual values.
- You can manipulate not just the value, but existence itself with `has` and `remove`, like with a set key. Lenses deal with exclusively values, not existence.

In general, it makes sense to implement `has` if you implement `remove` and `get` if you implement `set` or `update` - it makes sense to implement the reading variant without the modifying variant, like `has` without `remove`, but it doesn't make sense to implement `remove` without `has` unless the data is logically read-only. There are exceptions, particularly when it's a truly write-only view like `concat`, but these exceptions are relatively rare.

### View helpers

These are available via `immutable/core`

These exist because they cover relatively common use cases, but they are separate because they aren't critical.

Each of these return paths.

- `head` - Shift/unshift arrays, read first item
- `tail` - Push/pop arrays, read last item
- `item(key)`, alias: `count(key)` - Includes `key`, count occurrences of `key`, remove all occurrences of `key`
- `filter(selector)` - Matches `selector`, get items matching `selector`, replace all items matching `selector`, remove all values matching `selector`
- `reject(selector)` - Doesn't match `selector`, get items not matching `selector`, replace all items not matching `selector`, remove all values not matching `selector`
- `each` - View all entries individually.
- `firstItem(key)` - Includes `key`, remove first occurrence of `key`
- `slice(start, end)` - View a slice
- `concat` - Concat arrays
- `reverse` - View reversed
- `setAdd` - Set add
- `setKey(key)` - Set has/remove
- `mapKey(key)` - Map has/add/remove
- `invoke(method, ...args)` - Invoke method

Here's how each of these work:

- `head` views the first element of an array:
    - `create` returns `[]`.
    - `get` returns the first item of `object`, or `undefined` if it's empty.
    - `set` prepends the value to `object`.
    - `has` returns `true` if `object` is non-empty, `false` otherwise.
    - `remove` removes the first value from `object`.

- `tail` views the last element of an array:
    - `create` returns `[]`.
    - `get` returns the last item of `object`, or `undefined` if it's empty.
    - `set` appends the value to `object`.
    - `has` returns `true` if `object` is non-empty, `false` otherwise.
    - `remove` removes the last value from `object`.

- `item(key)` views a cursor on the array based on the value of an item.
    - `create` is not implemented. (This acts as a multiset-like key, not a map-like key.)
    - `get` returns the number of occurrences of `key` in `object`.
    - `set` is not implemented. (This acts as a multiset-like key, not a map-like key.)
    - `has` returns `true` if `object` includes `key`, `false` otherwise.
    - `remove` removes all occurrences of `key` in `object`.

- `filter(selector)` views a cursor over multiple entries based on whether an item matches a selector function.
    - `create` returns `[]`.
    - `get` returns the list of items where `selector(item, index)` returns truthy.
    - `set` replaces all items where `selector(item, index)` returns truthy with `value`.
    - `update` replaces all items where `selector(item, index)` returns truthy with `func(item)`.
    - `has` returns `true` if `selector(item, index)` returns truthy for any `item`, `false` otherwise.
    - `remove` removes all items where `selector(item, index)` returns truthy.

- `reject(selector)` views a cursor over multiple entries based on whether an item doesn't match a selector function.
    - `create` returns `[]`.
    - `get` returns the list of items where `selector(item, index)` returns falsy.
    - `set` replaces all items where `selector(item, index)` returns falsy with `value`.
    - `update` replaces all items where `selector(item, index)` returns falsy with `func(item)`.
    - `has` returns `true` if `selector(item, index)` returns falsy for any `item`, `false` otherwise.
    - `remove` removes all items where `selector(item, index)` returns falsy.

- `each` views a cursor over multiple entries of an array.
    - `create` returns `[]`.
    - `get` is not implemented. (Splitting is injective, not bijective.)
    - `set` replaces all items with `value`.
    - `update` replaces all items with `func(item)`.
    - `has` is not implemented.
    - `remove` is not implemented.

- `firstItem(key)` views a cursor on the array based on the value of an item.
    - `create` is not implemented.
    - `get` is not implemented. (This acts as a set-like key, not a map-like key.)
    - `set` is not implemented. (This acts as a set-like key, not a map-like key.)
    - `has` returns `true` if `object` includes `key`, `false` otherwise.
    - `remove` removes the first occurrence of `key` in `object`.

- `slice(start, end)` views a contiguous slice of an array.
    - `create` is not implemented. (This requires existing data before it can view it.)
    - `get` returns `array.slice(start, end)`
    - `set` updates the array's entries in the view's index range with the value's first `end - start` entries.
    - `has` is not implemented.
    - `remove` is not implemented.

- `concat` views an array and only permits updating with concatenation.
    - `create` returns `[]`.
    - `get` is not implemented. (Concatenation is injective, not bijective.)
    - `set` concatenates the list of values with the array.
    - `has` is not implemented.
    - `remove` is not implemented.

- `reverse` views the reversed representation of an array.
    - `create` returns `[]`.
    - `get` returns `array.slice().reverse()`.
    - `set` returns `value.slice().reverse()`.
    - `has` is not implemented.
    - `remove` is not implemented.

- `setAdd` views a set.
    - `create` returns `new Set()`.
    - `get` is not implemented.
    - `set` clones the set via its constructor (and potentially `Symbol.species`) or uses `new Set()` if the original set is `null`/`undefined`, invokes `set.add(value)`, and returns the newly created `set`.
    - `has` is not implemented.
    - `remove` is not implemented.

- `setKey(key)` views a particular key of a set.
    - `create` is not implemented.
    - `get` is not implemented.
    - `set` is not implemented.
    - `has` returns `set.has(key)`.
    - `remove` clones the set via its constructor (and potentially `Symbol.species`), invokes `set.delete(value)`, and returns the newly created `set`. If the original set is `null`/`undefined`, it returns `undefined`

- `mapKey(key)` views a particular key of a map.
    - `create` returns `new Map()`.
    - `get` returns `map.get(key)`.
    - `set` clones the map via its constructor (and potentially `Symbol.species`) or uses `new Map()` if the original set is `null`/`undefined`, invokes `set.add(key, value)`, and returns the newly created `set`.
    - `has` returns `map.has(key)`.
    - `remove` clones the map via its constructor (and potentially `Symbol.species`), invokes `map.delete(key)`, and returns the newly created `set`. If the original map is `null`/`undefined`, it returns `undefined`

- `invoke(method, ...args)` views a method invocation on an object.
    - `create` is not implemented.
    - `get` returns `object[method](...args)`, or `undefined` if the method doesn't exist.
    - `set` is not implemented.
    - `has` is not implemented.
    - `remove` is not implemented.

If not listed above, `view.update(object, func)` is implemented as an optimized version of `view.set(object, func(view.get(object)))` or omitted if either `get` or `set` are not implemented.

### Example

```js
const {p, c, i, set, update, remove, tail} = require("immutable/core")

// Some arbitrary structure
const thing = {
    foo: 'bar',

    fizz: 'buzz',

    bish: 'bash',

    utils: {
        mean(...set) {
            let sum = 0
            for (let i = 0; i < set.length; i++) sum += set[i] / set.length
            return sum
        },

        fibonacci(x) {
            let a = 0, b = 1
            for (let i = 2; i <= x; i++) {
                let c = a + b
                a = b
                b = c
            }
            return b
        },
    },

    stupidly: {
        deep: {
            structure: ['lol']
        },
        with: ['a', 'list', 'tacked', 'on'],
    },
}

// A deep patch
// Change the value of `foo`
thing = set(thing, "foo", "baz")
// Delete property `bish`
thing = remove(thing, "bish")
// Memoize `fibonacci`
thing = update(thing, c("utils", "fibonacci"), fibonacci => {
    const cache = Object.create(null)
    return x => x in cache ? cache[x] : cache[x] = fibonacci(x)
})
// ['lol', 'roflmao'] - it's appended to the end
thing = set(thing, c("stupidly", "deep", "structure", tail), "roflmao")
// ['a', 'copy', 'tacked', 'on'] - the original array is left untouched
thing = set(thing, c("stupidly", "with", 1), "copy")

// A deep patch with chaining
thing = i(thing)
    // Change the value of `foo`
    .set("foo", "baz")
    // Delete property `bish`
    .remove("bish")
    // Memoize `fibonacci`
    .update(c("utils", "fibonacci"), fibonacci => {
        const cache = Object.create(null)
        return x => x in cache ? cache[x] : cache[x] = fibonacci(x)
    })
    // ['lol', 'roflmao'] - it's appended to the end
    .set(c("stupidly", "deep", "structure", tail), "roflmao")
    // ['a', 'copy', 'tacked', 'on'] - the original array is left untouched
    .set(c("stupidly", "with", 1), "copy")
    .value

// A deep patch using a split view
const fibonacci = thing.utils.fibonacci
const cache = Object.create(null)
thing = set(remove(thing, "bish"), p({
    foo: undefined,
    utils: "fibonacci",
    stupidly: p({
        deep: c("structure", tail),
        with: 1,
    }),
}), {
    foo: "baz"
    utils: x => x in cache ? cache[x] : cache[x] = fibonacci(x),
    stupidly: {deep: "roflmao", with: "copy"}
})
```

### Async operations

These are available via `immutable/async`

These exist to help simplify backend data handling, querying, and other async operations.

- `A.create(view): Promise<newObject>`
- `A.has(object, view): Promise<boolean>`
- `A.get(object, view): Promise<value>`
- `A.set(object, view, value): Promise<newObject>`
- `A.update(object, view, func): Promise<newObject>`
- `A.remove(object, view): Promise<newObject>`
- `A.c(...paths): view`
- `A.p(...paths): view`
- `A.i(object): wrapper`

These are equivalent to their identically-named `immutable/core` counterparts, but `has`/`get`/`set`/`update`/`remove` all return promises to their values, and they all await all their intermediate results, including basic `has`/`get`/`set`/`update`/`remove` calls. `A.i`'s wrapper invokes the `A.*` methods instead of the standard ones and returns promises to wrappers from the `get`/`set`/`update`/`remove` methods rather than raw wrappers itself.

These may seem simple and nothing much, but you could easily define a handler for things like MongoDB queries, remote resources, among other things, for much easier manipulation of them.
