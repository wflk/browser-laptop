/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { makeImmutable } = require('./immutableUtil')
const uuidv4 = require('node-uuid').v4

const api = {

  addWindow: (state, action) => {
    let windowValue = makeImmutable(action).get('windowValue')
    if (!windowValue.get('windowUUID')) {
      windowValue = windowValue.set('windowUUID', uuidv4())
    }
    return state.set('windows', state.get('windows').push(windowValue))
  },

  maybeCreateWindow: (state, action) => {
    action = makeImmutable(action)
    let win = api.getByWindowId(state, action.getIn(['windowValue', 'windowId']))
    win = win || api.getByWindowUUID(state, action.getIn(['windowValue', 'windowUUID']))
    if (win) {
      return api.updateWindow(state, action)
    } else {
      return api.addWindow(state, action)
    }
  },

  getByWindowId: (state, windowId) => {
    return state.get('windows').find((win) => win.get('windowId') === windowId)
  },

  getWindowIndexByWindowId: (state, windowId) => {
    return state.get('windows').findIndex((win) => win.get('windowId') === windowId)
  },

  removeWindowByWindowId: (state, windowId) => {
    let index = api.getWindowIndexByWindowId(state, windowId)
    if (index === -1) {
      return state
    }
    return api.removeWindowByIndex(state, index)
  },

  removeWindowByIndex: (state, index) => {
    return state.set('windows', state.get('windows').delete(index))
  },

  removeWindow: (state, action) => {
    let windowId = makeImmutable(action).get('windowId')
    return api.removeWindowByWindowId(state, windowId)
  },

  getWindowUUIDForWindowID: (windowId) => {
    let win = api.getByWindowId(windowId)
    if (win) {
      return win.get('windowUUID')
    }
  },

  getWindowIndexByWindowUUID: (state, windowUUID) => {
    return state.get('windows').findIndex((win) => win.get('windowUUID') === windowUUID)
  },

  getByWindowUUID: (state, windowUUID) => {
    return state.get('windows').find((win) => win.get('windowUUID') === windowUUID)
  },

  updateWindow: (state, action) => {
    let windowValue = makeImmutable(action).get('windowValue')
    let windows = state.get('windows')
    let index = api.getWindowIndexByWindowId(state, windowValue.get('windowId'))
    if (index === -1) {
      return state
    }
    windowValue = windows.get(index).mergeDeep(windowValue)
    return state.set('windows', windows.delete(index).insert(index, windowValue))
  },

  getWindows: (state) => {
    return state.get('windows')
  },

  getPersistentState: (state) => {
    // TODO(bridiver) handle restoring state
    return state.delete('windows')
    // state = makeImmutable(state)
    // let windows = state.get('windows')
    // if (!windows)
    //   return state

    // windows = windows.map((window) => window.delete('windowId'))
    // return state.set('windows', windows)
  }
}

module.exports = api
