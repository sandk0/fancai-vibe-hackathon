/**
 * Navigation utility functions for consistent route matching across components.
 */

/**
 * Determines if a route is currently active based on the current path.
 *
 * @param currentPath - The current location pathname
 * @param targetPath - The target route path to check against
 * @returns true if the route is active (exact match for '/' or prefix match for other routes)
 *
 * @example
 * isActiveRoute('/library/123', '/library') // true
 * isActiveRoute('/library', '/library') // true
 * isActiveRoute('/settings', '/library') // false
 * isActiveRoute('/', '/') // true
 * isActiveRoute('/library', '/') // false
 */
export const isActiveRoute = (currentPath: string, targetPath: string): boolean => {
  if (targetPath === '/') {
    return currentPath === '/';
  }
  // Exact match OR sub-route
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
};
