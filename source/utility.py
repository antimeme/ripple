#! /usr/bin/env python
# ripple/generic.py
# Copyright (C) 2007-2011 by Jeff Gold.
# 
# This program is free software: you can redistribute it and/or
# modify it under the terms of the GNU General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see
# <http://www.gnu.org/licenses/>.
#
# ----------------------------------------------------------------------
'''Generally useful routines and classes.'''

def any(things):
    '''A backport of a built-in Python 2.5 function for use with 2.4.'''
    for thing in things:
        if thing: return True
    else: return False
def all(things):
    '''A backport of a built-in Python 2.5 function for use with 2.4.'''
    for thing in things:
        if not thing: return False
    else: return True

class Counter(object):
    '''Creates instances of an incrementing counter.

    >>> c = Counter()
    >>> c()
    0
    >>> c()
    1
    >>> c(2)
    3
    '''
    def __init__(self, value=0): self.value = value - 1
    def __call__(self, inc=1): self.value += inc; return self.value

def memoize(func):
    '''A simple caching decorator.

    Functions with this aspect store their output and return a
    result from the cache on subsequent invocations.  Obviously this
    is only useful for stateless functions and does not perform as
    well when the fuction arguments are mutable.  (Inspired by
    http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/466320)

    >>> @memoize
    ... def fib(n):
    ...     print 'computing fib(%d)' % n
    ...     if n >= 2:
    ...         return fib(n - 1) + fib(n - 2)
    ...     else: return 1
    ...
    >>> fib(5)
    computing fib(5)
    computing fib(4)
    computing fib(3)
    computing fib(2)
    computing fib(1)
    computing fib(0)
    8
    >>> fib(5)
    8
    '''
    cache = {}
    def result(*args, **kwargs):
        key = args + tuple(kwargs.items())
        try:
            hit = key in cache
        except TypeError:
            from cPickle import dumps, PickleError
            try:
                key = dumps(key)
                hit = key in cache
            except PickleError:
                return func(*args, **kwargs)
        if not hit:
            cache[key] = func(*args, **kwargs)
        return cache[key]
    return result

class AStarSearch(object):
    '''An implementation of the A* path finding algorithm.  See
    http://en.wikipedia.org/wiki/A*_search_algorithm for a general
    discussion.  This class is abstract and cannot be used directly.
    At least the neighbors() method must be overridden in a sub class,
    but the heuristic() and neigh_cost() methods should usually also
    get an implementation specific to the search space.

    >>> class CartesianSearch(AStarSearch):
    ...   def neighbors(self):
    ...      x, y = self.node
    ...      possible = ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
    ...      for p in possible:
    ...        if p not in ((1, 1), (2, 1), (1, 2)):
    ...           yield p
    ...   def heuristic(self, goal):
    ...      gx, gy = goal
    ...      x, y = self.node
    ...      return abs(gx - x) + abs(gy - y)
    ...
    >>> CartesianSearch.path((0, 0), (2, 2))
    [(0, 1), (0, 2), (0, 3), (1, 3), (2, 3), (2, 2)]
    >>> CartesianSearch.path((0, 0), (5, 0), limit=5)
    [(1, 0), (2, 0), (3, 0), (4, 0), (5, 0)]
    >>> CartesianSearch.path((0, 0), (5, 0), limit=4)
    >>>
    '''
    def __init__(self, node, goals, prev=None):
        self.node, self.prev = node, prev
        if prev is not None:
            self.cost = prev.cost + prev.neigh_cost(self.node)
        else: self.cost = 0
        self.__hcost = min(self.heuristic(goal) for goal in goals)
    def __cmp__(self, other):
        return cmp(self.cost + self.__hcost, other.cost + other.__hcost)

    def neighbors(self):
        '''Returns a list of nodes directly reachable from this one.
        This method is abstract since this class has no way to know
        the structure of the graph.'''
        raise NotImplementedError
    def neigh_cost(self, neighbor):
        '''Returns a numeric indication of the cost to reach the
        specified neighbor.  By default all transitions are given
        an identical cost.'''
        return 1
    def heuristic(self, goal):
        '''Returns an admissible estimate of the remaining cost to
        reach the specified goal, which means this may underestimate
        but must never overestimate that cost.  By default the
        esitmate is always zero, which makes an A* search devolve
        into Dijkstra's Algorithm.'''
        return 0

    @classmethod
    def path(cls, start, *goals, **params):
        '''Return an admissible path from start to a goal.  If no
        path is possible return None instead.  No parameters are
        recognized in the present implementation.'''
        if goals:
            limit = ('limit' in params) and params['limit'] or None
            start_node = cls(start, goals)
            openset, closedset = {start: start_node}, {}
            openheap = [start_node]
            while openheap:
                from heapq import heappop, heappush, heapify
                current = heappop(openheap)
                del openset[current.node]

                if current.node in goals:
                    path = []
                    while current.node != start:
                        path = [current.node] + path
                        current = current.prev
                    return path
                else: closedset[current.node] = True

                for neighbor in current.neighbors():
                    if neighbor in closedset:
                        continue

                    cost = current.cost + current.neigh_cost(neighbor)
                    if limit and cost > limit:
                        pass
                    elif neighbor not in openset:
                        node = cls(neighbor, goals, current)
                        heappush(openheap, node)
                        openset[neighbor] = node
                    else:
                        node = openset[neighbor]
                        if (cost < node.cost):
                            node.cost = cost
                            node.prev = current
                            # This is expensive: O(n) each time we
                            # find a faster path.  Unfortunately there
                            # seems to be no easy way to remove an
                            # element other than the top from a heap.
                            heapify(openheap)
        return None

if __name__ == '__main__': from doctest import testmod; testmod()
