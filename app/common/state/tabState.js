/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { makeImmutable } = require('./immutableUtil')
const windowState = require('./windowState')

const api = {

  getTabIndexByTabId: (state, tabId) => {
    return state.get('tabs').findIndex((tab) => tab.get('tabId') === tabId)
  },

  removeTabByTabId: (state, tabId) => {
    let index = api.getTabIndexByTabId(state, tabId)
    if (index === -1) {
      return state
    }
    return api.removeTabByIndex(state, index)
  },

  removeTabByIndex: (state, index) => {
    return state.set('tabs', state.get('tabs').delete(index))
  },

  closeFrame: (state, action) => {
    let tabId = makeImmutable(action).getIn(['frameProps', 'tabId'])
    return api.removeTabByTabId(state, tabId)
  },

  removeTab: (state, action) => {
    let tabId = makeImmutable(action).get('tabId')
    return api.removeTabByTabId(state, tabId)
  },

  insertTab: (state, action) => {
    let tabValue = makeImmutable(action).get('tabValue')
    return state.set('tabs', state.get('tabs').push(tabValue))
  },

  maybeCreateTab: (state, action) => {
    action = makeImmutable(action)
    let tab = api.getByTabId(state, action.getIn(['tabValue', 'tabId']))
    tab = tab || api.getByTabUUID(state, action.getIn(['tabValue', 'tabUUID']))
    if (tab) {
      return api.updateTab(state, action)
    } else {
      return api.insertTab(state, action)
    }
  },

  getOrCreateByTabId: (state, tabId) => {
    let tab = api.getByTabId(state, tabId)
    return tab || api.createTab({tabId})
  },

  getTabsByWindowUUID: (state, windowUUID) => {
    return state.get('tabs').filter((tab) => tab.get('windowUUID') === windowUUID)
  },

  getTabsByWindowId: (state, windowId) => {
    return state.get('tabs').filter((tab) => tab.get('windowId') === windowId)
  },

  getTabsForWindow: (state, windowValue) => {
    windowValue = makeImmutable(windowValue)
    let windowId = windowValue.get('windowId')
    let windowUUID = windowValue.get('windowUUID')
    return state.get('tabs').filter((tab) => tab.get('windowId') === windowId || tab.get('windowUUID') === windowUUID)
  },

  getByTabUUID: (state, uuid) => {
    return state.get('tabs').find((tab) => tab.get('uuid') === uuid)
  },

  getByWindowUUID: (state, windowUUID) => {
    return state.get('tabs').find((tab) => tab.get('windowUUID') === windowUUID)
  },

  getByWindowID: (state, windowId) => {
    return state.get('tabs').find((tab) => tab.get('windowId') === windowId)
  },

  getByTabId: (state, tabId) => {
    return state.get('tabs').find((tab) => tab.get('tabId') === tabId)
  },

  updateTab: (state, action) => {
    let tabValue = makeImmutable(action).get('tabValue')
    tabValue = tabValue.set('windowUUID', windowState.getWindowUUIDForWindowID(state, tabValue.get('windowId')))
    let tabs = state.get('tabs')
    let index = api.getTabIndexByTabId(state, tabValue.get('tabId'))
    if (index === -1) {
      return state
    }
    tabValue = tabs.get(index).mergeDeep(tabValue)
    return state.set('tabs', tabs.delete(index).insert(index, tabValue))
  },

  getTabs: (state) => {
    return state.get('tabs')
  },

  setTabs: (state, tabs) => {
    return state.set('tabs', tabs)
  },

  getPersistentState: (state) => {
    // TODO(bridiver) - handle restoring tabs
    return state.delete('tabs')
    // state = makeImmutable(state)
    // // TODO(bridiver) handle pinned tabs
    // let tabs = state.get('tabs')
    // if (!tabs) {
    //   return state
    // }

    // tabs = tabs.filter((tab) => tab.get('incognito') !== true)
    //   .map((tab) => {
    //     return new Immutable.fromJS({
    //       url: tab.get('url'),
    //       uuid: tab.get('uuid'),
    //       index: tab.get('index'),
    //       active: tab.get('active'),
    //       windowUUID: tab.get('windowUUID'),
    //       title: tab.get('title'),
    //       faviconUrl: tab.get('faviconUrl'),
    //       history: tab.get('history')
    //     })
    //   })
    // return state.set('tabs', tabs)
  }
}

module.exports = api
