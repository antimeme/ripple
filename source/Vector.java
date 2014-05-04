// Matrix.java
// Copyright (C) 2008 by Jeff Gold.
//
// This program is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see
// <http://www.gnu.org/licenses/>.
//
// ---------------------------------------------------------------------
package net.esclat.ripple;
import net.esclat.ripple.Matrix;

public class Vector extends Matrix {
    static final long serialVersionUID = 0;

    public Vector(float elements[]) {
        super(elements.length, 1, elements);
    }
    public Vector(Vector source) {
        super(source);
    }

    public Vector multiply(float value) {
        Vector result = new Vector(this);
        for (int i = 0; i < result.elements.length; i++)
            result.elements[i] *= value;
        return result;
    }

    public Matrix translate(boolean homogeneous) {
        int length = elements.length + (homogeneous ? 0 : 1);
        Matrix result = new Matrix(length, length);
        for (int row = 0; row < length; row++)
            for (int col = 0; col < length; col++) {
                float value = 0;
                if (row == col)
                    value = 1;
                else if ((col + 1 == length) &&
                    (row < elements.length))
                    value = elements[row];
                result.setElement(row, col, value);
            }
        return result;
    }
    public Matrix translate() { return translate(false); }

    public Matrix scale(boolean homogeneous) {
        int length = elements.length + (homogeneous ? 0 : 1);
        Matrix result = new Matrix(length, length);
        for (int row = 0; row < length; row++)
            for (int col = 0; col < length; col++) {
                float value = 0;
                if (row == col) {
                    if (row < elements.length)
                        value = elements[row];
                    else value = 1;
                }
                result.setElement(row, col, value);
            }
        return result;
    }
    public Matrix scale() { return scale(false); }

    public Matrix rotate(float radians) {
        // :TODO: how to create an arbitrary rotation around a vector?
        // I have a hunch that the exterior product may be part of the
        // solution here, as with the cross product
        return null;
    }

    public Vector normalize() {
        Vector result = new Vector(elements);
        double magnitude = Math.sqrt(this.dotProduct(this));
        for (int i = 0; i < result.elements.length; i++)
            result.elements[i] /= magnitude;
        return result;
    }

    public float dotProduct(Vector other) {
        if (other.elements.length != elements.length)
            throw new WrongSizeException();
        float result = 0;
        for (int i = 0; i < elements.length; i++)
            result += elements[i] * other.elements[i];
        return result;
    }

    public Matrix crossProduct() {
        // :TODO: this would be simple if confined to three
        // dimensions, but I want a generalized version.  That means
        // taking the Hodge dual of the exterior product.  And I'll
        // implement that...
        // just as soon as I figure out what any of it means.
        // http://en.wikipedia.org/wiki/Exterior_product
        // http://en.wikipedia.org/wiki/Hodge_dual
        return null;
    }

    public static void main(String[] args) {
        Vector v;
        if (args.length > 0) {
            float a[] = new float[args.length];
            for (int i = 0; i < args.length; i++)
                a[i] = Float.parseFloat(args[i]);
            v = new Vector(a);
        } else {
            float a[] = {3f, -1f, 2f};
            v = new Vector(a);
        }

        System.out.println("Vector v:");
        System.out.println(v.toString());
        System.out.println("v.equals(v) : " + v.equals(v));
        System.out.println("v.translate()");
        System.out.println(v.translate());
        System.out.println("v.scale()");
        System.out.println(v.scale());
    }
}
