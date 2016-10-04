/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const tabState = require('./tabState')
const { makeImmutable } = require('./immutableUtil')

const loginRequiredDetail = 'loginRequiredDetail'

const basicAuthState = {
  setLoginRequiredDetail: (state, action) => {
    state = makeImmutable(state)
    action = makeImmutable(action)
    let tabId = action.get('tabId')
    let detail = action.get('detail')
    let tabValue = tabState.getByTabId(state, tabId)
    if (!detail || detail.size === 0) {
      tabValue = tabValue.delete(loginRequiredDetail)
    } else {
      tabValue = tabValue.set(loginRequiredDetail, detail)
    }
    return tabState.updateTab(state, tabValue)
  },

  getLoginRequiredDetail: (state, tabId) => {
    state = makeImmutable(state)
    let tab = tabState.getByTabId(state, tabId)
    return tab && tab.get(loginRequiredDetail)
  },

  setLoginResponseDetail: (state, action) => {
    state = makeImmutable(state)
    action = makeImmutable(action)
    let tabId = action.get('tabId')
    let tab = tabState.getByTabId(state, tabId)
    if (!tab) {
      return state
    }
    tab = tab.delete(loginRequiredDetail)
    return tabState.updateTab(state, tabId, tab)
  }
}

module.exports = basicAuthState
