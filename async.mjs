/* global Map, Set */

import {isIntegerIndex, updateKey, fromEntries} from "./helpers.mjs"

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                        C O R E   M E T H O D S                        *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                      ` c r e a t e ( v i e w ) `                      *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export async function create(view) {
    if (view == null) return undefined
    if (typeof view === "object") return view.create()
    if (isIntegerIndex(view)) return []
    return {}
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 ` g e t ( o b j e c t ,   v i e w ) `                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export async function get(object, view) {
    if (object == null) return undefined
    if (view == null) return object
    if (typeof view !== "object") return object[view]
    return view.get(object)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *          ` s e t ( o b j e c t ,   v i e w ,   v a l u e ) `          *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export async function set(object, view, value) {
    if (view == null) return value
    if (typeof view !== "object") return updateKey(object, view, value)
    if (object == null) object = await view.create()
    if ("set" in view) return view.set(object, value)
    return view.update(object, () => value)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *        ` u p d a t e ( o b j e c t ,   v i e w ,   f u n c ) `        *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export async function update(object, view, func) {
    if (view == null) return object
    if (typeof view !== "object") {
        return updateKey(object, view, func(object[view]))
    }
    if ("update" in view) return view.update(object, func)
    return view.set(object, func(
        object == null ? undefined : await view.get(object))
    )
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 ` h a s ( o b j e c t ,   v i e w ) `                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export async function has(object, view) {
    if (object == null) return false
    if (view == null) return true
    if (typeof view !== "object") return view in object
    return !!await view.has(object)
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *              ` r e m o v e ( o b j e c t ,   v i e w ) `              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

export async function remove(object, view) {
    if (object == null) return undefined
    if (view == null) return object
    if (typeof view === "object") return view.remove(object)
    const result = isIntegerIndex(view) ? [] : {}

    for (const key of Object.keys(view)) {
        if (key !== view) result[key] = object[key]
    }

    return result
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *             W R A P P E R   A P I :   ` i ( v a l u e ) `             *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function wrap(wrapped) {
    return {
        value: wrapped,
        valueOf: () => wrapped,
        get: async view => wrap(await get(wrapped, view)),
        set: async (view, value) => wrap(await set(wrapped, view, value)),
        update: async (view, func) => wrap(await update(wrapped, view, func)),
        has: async view => wrap(await has(wrapped, view)),
        remove: async view => wrap(await remove(wrapped, view)),
    }
}
export {wrap as i}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *                 C O R E   V I E W   F A C T O R I E S                 *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *              C O M P O S E :   ` c ( . . . v i e w s ) `              *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function compose(...views) {
    if (views.length === 0) return undefined
    if (views.length === 1) return views[0]

    const nest = async (object, i, onEnd, arg) => i + 1 === views.length
        ? onEnd(object, views[i], arg)
        : update(object, views[i], object => nest(object, i + 1, onEnd, arg))

    async function loop(object, ifNull, ifMatched) {
        for (const view of views.slice(0, -1)) {
            object = await get(object, view)
            if (object == null) return ifNull
        }

        return ifMatched(object, views[views.length - 1])
    }

    return {
        create: () => create(views[0]),
        get: object => loop(object, undefined, get),
        set: (object, value) => nest(object, 0, set, value),
        update: (object, func) => nest(object, 0, update, func),
        has: object => loop(object, undefined, has),
        remove: object => nest(object, 0, remove),
    }
}
export {compose as c}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                                                                       *
 *            P R O P E R T Y :   ` p ( { . . . k e y s } ) `            *
 *                                                                       *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

function splitProperty(props) {
    const pairs = Object.entries(props)
    const mapProps = func => Promise.all(pairs.map(func)).then(fromEntries)

    return {
        create: () => mapProps(pair => create(pair[1])),
        get: object => mapProps(([key, path]) => get(object[key], path)),
        set: async (object, value) => ({...object, ...await mapProps(
            ([key, path]) => set(object[key], path, value[key])
        )}),
        has: async object => {
            for (const [key, path] of pairs) {
                if (await has(object[key], path)) return true
            }
            return false
        },
        remove: object => mapProps(([key, path]) => remove(object[key], path)),
    }
}
export {splitProperty as p}
