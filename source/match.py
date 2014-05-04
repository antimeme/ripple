#! /usr/bin/env python
# Copyright (C) 2011-2013 by Jeff Gold.
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
'''Useful routines for matching strings.'''
import re, itertools

def string_metric(a, b, cost_i=1, cost_d=1, cost_s=1, cost_t=1):
    '''Return a metric which is the edit distance between two strings.
    This metric is zero iff the strings are the same and grows larger
    as the effort necessary to transform one into the other increases.

    This implementation calculates the Damerau-Levenshtein distance:
    http://en.wikipedia.org/wiki/Damerau%E2%80%93Levenshtein_distance

    >>> string_metric('testing', 'testing')
    0
    >>> string_metric('testing', 'test', cost_d=1.5)
    4.5
    >>> string_metric('testing', 'testinging', cost_d=1.5, cost_i=2)
    6.0
    >>> string_metric('testing', 'tasting', cost_s=.5)
    0.5
    >>> string_metric('testing', 'tasting', cost_s=3)
    2
    >>> string_metric('testing', 'tseting')
    1
    >>> string_metric('testing', 'aubergine')
    6

    @param a first string to compare
    @param b first string to compare
    @param cost_i how expensive is inserting characters
    @param cost_d how expensive is deleting characters
    @param cost_s how expensive is character substitution
    @param cost_d how expensive is character transposition
    '''
    # Store only the previous two rows since the rest stop mattering
    prevprev = None
    prev = list(cost_d * x for x in xrange(len(a) + 1))

    for row, b_row in zip(itertools.count(1), b):
        next = [row * cost_i]
        for col, a_col in zip(itertools.count(1), a):
            cost = prev[col - 1]
            if a_col != b_row:
                cost += cost_s
            if (prevprev is not None and col > 1 and
                a_col == b[row - 2] and
                a[col - 2] == b_row):
                cost = min(cost, prevprev[col - 2] + cost_t)
            next.append(min(cost, next[col - 1] + cost_d,
                            prev[col] + cost_i))
        prevprev = prev
        prev = next
    return prev[-1]

def match_name_chunk(chunk_a, chunk_b, swaps={}):
    '''Deterimine whether two name chunks are equivalent.
    On success return the longest chunk.  On failure return None.

    >>> (match_name_chunk('Robert', 'robert') and
    ...  match_name_chunk('Robert', 'R') and
    ...  match_name_chunk('Bob', 'R', swaps={'bob': 'Robert'}) and
    ...  match_name_chunk('Robert', 'Bob', swaps={'bob': 'Robert'}))
    'Robert'
    >>> (match_name_chunk('John', 'Fred') or
    ...  match_name_chunk('John','Jake'))
    '''
    aa = a = re.sub("[.']", '', chunk_a).lower()
    bb = b = re.sub("[.']", '', chunk_b).lower()
    if swaps:
        if a in swaps:
            chunk_a = swaps[a]
            aa = re.sub("[.']", '', chunk_a).lower()
        if b in swaps:
            chunk_b = swaps[b]
            bb = re.sub("[.']", '', chunk_b).lower()
    if ((a == b) or (aa == bb) or
        (a.find(b) == 0) or (b.find(a) == 0) or
        (aa.find(bb) == 0) or (bb.find(aa) == 0)):
        result = sorted((chunk_a, chunk_b),
                        cmp=lambda a, b:
                            cmp(len(b), len(a)))[0]
        return result.isupper() and result.title() or result
    return None

def match_names(base, *names, **kwargs):
    '''Return true iff the names are equivalent.
    On success return the best possible name according to the assumption
    that more and longer chunks are preferable.

    >>> match_names("ODONNELL, ROBERT", "ROBERT SCOTT ODONNELL",
    ...             'Robert SCOTT-ODonnell', 'Bob Odonnell', 
    ...             'Rob ODonnell M.D.  PH.D.', 'R.S.O.',
    ...             "Doctor Robert S O'Donnell", 'SCOTT ODonnell',
    ...             strip_prefix=('Doctor',),
    ...             strip_suffix=('MD', 'PhD'),
    ...             swaps={'bob': 'Robert'})
    "Robert Scott O'Donnell"
    >>> match_names("Robert Scott O'Donnell", "Robert Doe")
    >>> match_names("Robert Scott O'Donnell", "Fred Scott O'Donnell")
    '''
    # Stip out titles using either a precompiled regular expression
    # or one generated from a list of strings.  Because punctuation
    # can be unpredictable, a dot is accepted after any letter.  The
    # crazy generator expression below will not be on the test.
    def setup_dotted_regexp(base, stag, ltag):
        re_target = None
        if 're_%s' % stag in kwargs:
            re_target = kwargs['re_%s' % stag]
        elif ltag in kwargs:
            values = kwargs[ltag]
            if isinstance(values, basestring):
                values = (values,)
            re_target = re.compile(
                base % '|'.join(
                    ''.join(itertools.chain(
                            *zip(re.sub('\\.', '', value),
                                 itertools.repeat('\\.?'))))
                    for value in values), flags=re.I)
        return re_target
    re_prefix = setup_dotted_regexp('^\\s*((%s)\\s\\s*)*',
                                    'prefix', 'strip_prefix')
    re_suffix = setup_dotted_regexp('(\\s\\s*(%s))*\\s*$',
                                    'suffix', 'strip_suffix')

    # Permit custom subsitutions to support unusual names
    swaps = ('swaps' in kwargs) and kwargs['swaps'] or {}

    def prepare(name):
        '''Process a name in preparation for a comparison'''
        if re_prefix: name = re_prefix.sub('', name)
        if re_suffix: name = re_suffix.sub('', name)
        if name.find(',') >= 0:
            names = name.split(',')
            if len(names) == 2:
                names.reverse()
                name = ' '.join(n.strip() for n in names)
        for chunk in name.split(' '):
            for sub in chunk.split('-'):
                for subsub in sub.split('.'):
                    if subsub:
                        yield subsub

    # Compare names chunk by chunk
    name_a = tuple(prepare(base))
    for name_b in (tuple(prepare(name)) for name in names):
        alpha, beta = ((len(name_a) >= len(name_b)) and
                       (name_a, name_b) or (name_b, name_a))
        candidates = dict((chunk, None) for chunk in alpha)
        for chunk in beta:
            found = False
            for can in candidates:
                if candidates[can] is not None:
                    continue
                candidates[can] = match_name_chunk(
                    chunk, can, swaps=swaps)
                if candidates[can]:
                    found = True
                    break
            if not found:
                return None
        name_a = tuple(candidates[chunk] or chunk for chunk in alpha)
    return ' '.join(name_a)

if __name__ == '__main__':
    import sys, doctest
    if doctest.testmod().failed:
        sys.exit(1)
