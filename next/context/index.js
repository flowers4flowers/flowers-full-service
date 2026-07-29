// next/context/index.js

"use client";

import { createContext, useContext, useReducer } from "react";

// GLOBAL STATE
const AppStateContext = createContext();

const initialState = {
  hideHomeLink: false,
  hideNav: false,
  currentProjectCaptions: [],
  mobileMenuOpen: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_HIDE_HOME_LINK":
      return {
        ...state,
        hideHomeLink: action.payload,
      };
    case "SET_HIDE_NAV":
      return {
        ...state,
        hideNav: action.payload,
      };
    case "SET_CURRENT_PROJECT_CAPTIONS":
      return {
        ...state,
        currentProjectCaptions: action.payload,
      };
    case "SET_MOBILE_MENU_OPEN":
      return {
        ...state,
        mobileMenuOpen: action.payload,
      };
    default:
      return state;
  }
}

export function AppWrapper({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const state = useContext(AppStateContext);

  if (state === undefined) {
    throw new Error("useAppState must be used within a SiteContextProvider");
  }

  return state;
}
