'use client'

import { createContext, useContext, useReducer } from 'react'

// GLOBAL STATE
const AppStateContext = createContext()

const initialState = {
  homeCarouselOpen: false,
  homeCarouselData: null,
  homeCarouselClose: false,
  homeCarouselSide: null,
  hideHomeLink: false,
  hideNav: false,
  currentProjectTitle: null,
  currentProjectCaptions: [],
  mobileMenuOpen: false,
  showViewImages: false
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_HOME_CAROUSEL_OPEN':
      return {
        ...state,
        homeCarouselOpen: action.payload
      }
    case 'SET_HOME_CAROUSEL_DATA':
      return {
        ...state,
        homeCarouselData: action.payload
      }
    case 'SET_HOME_CAROUSEL_CLOSE':
      return {
        ...state,
        homeCarouselClose: action.payload
      }
    case 'SET_HOME_CAROUSEL_SIDE':
      return {
        ...state,
        homeCarouselSide: action.payload
      }
    case 'SET_HIDE_HOME_LINK':
      return {
        ...state,
        hideHomeLink: action.payload
      }
    case 'SET_HIDE_NAV':
      return {
        ...state,
        hideNav: action.payload
      }
    case 'SET_CURRENT_PROJECT_TITLE':
      return {
        ...state,
        currentProjectTitle: action.payload
      }
    case 'SET_CURRENT_PROJECT_CAPTIONS':
      return {
        ...state,
        currentProjectCaptions: action.payload
      }
    case 'SET_MOBILE_MENU_OPEN':
      return {
        ...state,
        mobileMenuOpen: action.payload
      }
    case 'SET_SHOW_VIEW_IMAGES':
      return {
        ...state,
        showViewImages: action.payload
      }
    default:
      return state
  }
}

export function AppWrapper({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  return (
    <AppStateContext.Provider
      value={{state, dispatch}}
    >
      {children}
    </AppStateContext.Provider>
  )
}

export function useAppState() {
  const state = useContext(AppStateContext)

  if (state === undefined) {
    throw new Error('useAppState must be used within a SiteContextProvider')
  }

  return state
}