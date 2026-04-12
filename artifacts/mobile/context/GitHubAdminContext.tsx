import React, { createContext, useContext, useState } from 'react';

const GitHubAdminContext = createContext();

export const GitHubAdminProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [products, setProducts] = useState([]);

    // GitHub authentication and product management functions go here

    return (
        <GitHubAdminContext.Provider value={{ isAuthenticated, setIsAuthenticated, products, setProducts }}>
            {children}
        </GitHubAdminContext.Provider>
    );
};

export const useGitHubAdmin = () => useContext(GitHubAdminContext);
