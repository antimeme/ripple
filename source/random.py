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
'''A pseudo-random number generator with reliable output.'''

class Random(object):
    '''An implementation of the Mersenne Twister.  There is a
    perfectly good implementation of this within Python already
    (probably with better performance due to the use of a C library)
    but there's no guarantee that future versions of Python won't
    change to something else.  This implementation is intended for
    pseudo-randomly generating content, so its output must be
    absolutely predictable.'''
    N = 624
    M = 397
    MATRIX_A = 0x9908B0DFL
    UPPER_MASK = 0x80000000L
    LOWER_MASK = 0x7FFFFFFFL
    MAXIMUM    = 0xFFFFFFFFL
    TAOCP2P106 = 1812433253L
    TEMPER_B   = 0x9D2C5680L
    TEMPER_C   = 0xEFC60000L

    mag01 = (0, MATRIX_A)

    def __init__(self, seed):
        '''
        >>> r = Random(5489)
        >>> for x in range(10): print('mt[%d] = %08x' % (x, r.mt[x]))
        mt[0] = 00001571
        mt[1] = 4d98ee96
        mt[2] = af25f095
        mt[3] = afd9ba96
        mt[4] = 6fcbd068
        mt[5] = 2cd06a72
        mt[6] = 384f0100
        mt[7] = 85b46507
        mt[8] = 295e8801
        mt[9] = 0d1b316e
        '''
        self.mt = [seed & self.MAXIMUM]
        self.mti = self.N;
        for mti in range(1, self.mti):
            self.mt.append((self.TAOCP2P106 *
                            (self.mt[mti - 1] ^
                             (self.mt[mti - 1] >> 30)) + mti) &
                           self.MAXIMUM)

    def uint32(self):
        '''
        >>> r = Random(5489)
        >>> for x in range(10): print("%x" % r.uint32())
        d091bb5c
        22ae9ef6
        e7e1faee
        d5c31f79
        2082352c
        f807b7df
        e9d30005
        3895afe1
        a1e24bba
        4ee4092b
        '''
        if self.mti >= self.N:
            for ii in range(self.N - self.M):
                current = ((self.mt[ii] & self.UPPER_MASK) |
                           (self.mt[ii + 1] & self.LOWER_MASK))
                self.mt[ii] = (self.mt[ii + self.M] ^
                               (current >> 1) ^ self.mag01[current & 1])
            for ii in range(self.N - self.M, self.N - 1):
                current = ((self.mt[ii] & self.UPPER_MASK) |
                           (self.mt[ii + 1] & self.LOWER_MASK))
                self.mt[ii] = (self.mt[ii + self.M - self.N] ^
                               (current >> 1) ^ self.mag01[current & 1])
            current = ((self.mt[self.N - 1] & self.UPPER_MASK) |
                       (self.mt[0] & self.LOWER_MASK))
            self.mt[self.N - 1] = (self.mt[self.M - 1] ^
                                   (current >> 1) ^
                                   self.mag01[current & 1])
            self.mti = 0;

        current = self.mt[self.mti];
        self.mti += 1
        current ^= current >> 11;
        current ^= (current << 7) & self.TEMPER_B;
        current ^= (current << 15) & self.TEMPER_C;
        current ^= current >> 18;
        return current;

if __name__ == '__main__':
    import sys, doctest
    if doctest.testmod().failed:
        sys.exit(1)
