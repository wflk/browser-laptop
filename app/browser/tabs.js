const {app, BrowserWindow, session, webContents} = require('electron')
const appActions = require('../../js/actions/appActions')
const extensions = process.atomBinding('extension')
const { makeImmutable } = require('../common/state/immutableUtil')
const tabState = require('../common/state/tabState')
const uuidv4 = require('node-uuid').v4

let currentWebContents = {}
let activeTab = null

const cleanupWebContents = (tabId) => {
  delete currentWebContents[tabId]
  process.nextTick(() => {
    appActions.tabClosed(tabId)
  })
}

const getTabValue = function (tabId) {
  let tab = api.getWebContents(tabId)
  if (tab) {
    let tabValue = makeImmutable(extensions.tabValue(tab))
    // TODO(bridiver) - set history from navigation controller
    tabValue.set('history', [])
    return tabValue
  }
}

const registerGuest = (createProperties, isRestore = false) => {
  // TODO(bridiver) - make this available from electron
  let payload = {}
  process.emit('ELECTRON_GUEST_VIEW_MANAGER_NEXT_INSTANCE_ID', payload)
  let guestInstanceId = payload.returnValue

  let newSession = session.defaultSession
  let opener = null
  let embedder = null
  if (!isRestore) {
    let win = BrowserWindow.getFocusedWindow()
    let windowId = createProperties.get('windowId')
    if (windowId && windowId !== -2) {
      win = BrowserWindow.fromId(windowId) || win
    }
    if (!win) {
      throw new Error('Could not find a window for new tab')
    } else {
      embedder = win.webContents
    }
    let openerTabId = createProperties.get('openerTabId')
    if (openerTabId) {
      opener = api.getWebContents(openerTabId)
      if (!opener) {
        throw new Error('Opener does not exist')
      }
      // only use the opener if it is in the same window
      if (opener.webContents.hostWebContents !== win.webContents) {
        throw new Error('Opener must be in the same window as new tab')
      }
    }

    opener = opener || activeTab
    if (opener) {
      newSession = opener.session
    }
  }

  let webPreferences = {
    isGuest: true,
    embedder,
    session: newSession,
    guestInstanceId,
    delayedLoadUrl: createProperties.get('url') || 'about:newtab'
  }

  if (opener) {
    webPreferences = Object.assign({}, opener.getWebPreferences(), webPreferences)
  }

  let guest = webContents.create(webPreferences)
  process.emit('ELECTRON_GUEST_VIEW_MANAGER_REGISTER_GUEST', {}, guest, guestInstanceId)
  return { webContents: guest, opener }
}

const createInternal = (createProperties, guest, cb = null) => {
  return new Promise((resolve, reject) => {
    let opener = guest.opener
    let tab = guest.webContents
    tab.once('did-attach', () => {
      cb && cb(tab)
    })
    tab.once('did-fail-provisional-load', (e) => {
      resolve(tab, e)
    })
    tab.once('did-fail-load', (e) => {
      resolve(tab, e)
    })
    tab.once('did-finish-load', (e) => {
      resolve(tab, e)
    })
    let active = createProperties.get('active') !== false
    if (!active) {
      active = createProperties.get('selected') !== false
    }
    let disposition = active ? 'foreground-tab' : 'background-tab'

    process.emit('ELECTRON_GUEST_VIEW_MANAGER_TAB_OPEN',
      { sender: opener }, // event
      'about:blank',
      '',
      disposition,
      { webPreferences: tab.getWebPreferences() })
  })
}

const updateTab = (tabId) => {
  let tabValue = getTabValue(tabId)
  if (tabValue) {
    process.nextTick(() => {
      appActions.tabUpdated(tabValue)
    })
  }
}

// const restoreTab = (savedTabState) => {
//   savedTabState = makeImmutable(savedTabState)
//   let guest = registerGuest(savedTabState, true).webContents
//   return savedTabState.set('tabId', guest.getId())
//   // TODO(bridiver) - restore history from savedTabState.get('history')
// }

const api = {
  init: (state, action) => {
    app.on('web-contents-created', function (event, tab) {
      // TODO(bridiver) - also exclude extension action windows??
      if (extensions.isBackgroundPage(tab) || !tab.hostWebContents) {
        return
      }
      let tabId = tab.getId()
      tab.once('destroyed', cleanupWebContents.bind(null, tabId))
      tab.once('crashed', cleanupWebContents.bind(null, tabId))
      tab.once('close', cleanupWebContents.bind(null, tabId))
      tab.on('set-active', function (evt, active) {
        if (active) {
          activeTab = tab
        }
        updateTab(tabId)
      })
      tab.on('page-favicon-updated', function (e, favicons) {
        if (favicons && favicons.length > 0) {
          tab.setTabValues({
            faviconUrl: favicons[0]
          })
          updateTab(tabId)
        }
      })
      tab.on('did-attach', () => {
        updateTab(tabId)
      })
      tab.on('did-detach', () => {
        updateTab(tabId)
      })
      tab.on('page-title-updated', function () {
        updateTab(tabId)
      })
      tab.on('did-fail-load', function () {
        updateTab(tabId)
      })
      tab.on('did-fail-provisional-load', function () {
        updateTab(tabId)
      })
      tab.on('did-stop-loading', function () {
        updateTab(tabId)
      })
      tab.on('navigation-entry-commited', function (evt, url) {
        updateTab(tabId)
      })
      tab.on('did-navigate', function (evt, url) {
        updateTab(tabId)
      })
      tab.on('load-start', function (evt, url, isMainFrame, isErrorPage) {
        if (isMainFrame) {
          updateTab(tabId)
        }
      })
      tab.on('did-finish-load', function () {
        updateTab(tabId)
      })

      currentWebContents[tabId] = tab
      let tabValue = getTabValue(tabId)
      if (tabValue) {
        if (!tabValue.get('uuid')) {
          tabValue = tabValue.set('uuid', uuidv4())
        }
        process.nextTick(() => {
          appActions.tabCreated(tabValue)
        })
      }
    })

    // TODO(bridiver) - handle restoring of state
    // let tabs = tabState.getTabs(state).map((tab) => restoreTab(tab))
    // return tabState.setTabs(state, tabs)
    return state
  },

  getWebContents: (tabId) => {
    return currentWebContents[tabId]
  },

  setAudioMuted: (state, action) => {
    action = makeImmutable(action)
    let frameProps = action.get('frameProps')
    let muted = action.get('muted')
    let tabId = frameProps.get('tabId')
    let webContents = api.getWebContents(tabId)
    if (webContents) {
      webContents.setAudioMuted(muted)
      let tabValue = getTabValue(tabId)
      return tabState.updateTab(state, { tabValue })
    }
  },

  newTab: (state, action) => {
    try {
      action = makeImmutable(action)
      let createProperties = action.get('createProperties')
      let guest = registerGuest(createProperties)
      createInternal(createProperties, guest).catch((err) => {
        console.error(err)
        // TODO(bridiver) - report the error in the state
      })
      let tab = guest.webContents
      let tabValue = makeImmutable({
        uuid: uuidv4(),
        tabId: tab.getId()
      })
      return tabState.insertTab(state, { tabValue })
    } catch (err) {
      console.error(err)
      // TODO(bridiver) - report the error
      return state
    }
  },

  closeTab: (state, action) => {
    action = makeImmutable(action)
    let tabId = action.get('tabId')
    let tab = api.getWebContents(tabId)
    try {
      if (!tab.isDestroyed()) {
        tab.close()
      }
    } catch (e) {
      // ignore
    }
    return tabState.removeTabByTabId(state, tabId)
  },

  create: (createProperties, cb = null) => {
    try {
      let guest = registerGuest(createProperties)
      return createInternal(createProperties, guest, cb)
    } catch (e) {
      cb && cb()
      return new Promise((resolve, reject) => { reject(e.message) })
    }
  }
}

module.exports = api
