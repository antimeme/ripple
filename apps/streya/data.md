---
title: "Streya Data Definition"
abstract-title: "<h2>Introduction</h2>"
abstract: |
  Streya is a systemic game set in the solar system of a
  not-too-distant future.  This document attempts to explain how
  Streya stores data.  It is organized in a manner parallel to the
  structure expected in the JSON input format.  Expectations about
  type are encoded in the section headings.
comments: |
  This is a Markdown document in GitHub format intended to be
  processed using pandoc.  `sudo apt install -y pandoc &&
  pandoc -s -f gfm+smart --css data.css --toc --toc-depth=4 data.md`
---

## schema: object{object}

A schema section provided metadata intended to clarify the way other
data is to be interpreted.

### version: string

A version string is a [semantic version number](https://semver.org/)
which describes the version of the schema in use.  This is meant to
support reading data in older formats for backward compatability.

At the moment, only one version string is supported: 0.0.1

## icons: array[object]

Describes vector drawing icons for user interface purposes.

### type: string

Indicates which drawing operation will be used.  Drawing operations
are:

  - `polygon`: a closed shape following vertices
  - `circle`: all points a given distance from a center
  
### radius: number(non-negative-float)

This supports the `circle` type.  This is the radius.  It must be
between zero and one, inclusive.

### x: number(float-one-minus-one)

This supports the `circle` type.  Horizontal coordinate of this shape.
One and minus one are the extents of the icon and must not be
exceeded.

### y: number(float-one-minus-one)

This supports the `circle` type.  Vertical coordinate of this shape.
One and minus one are the extents of the icon and must not be
exceeded.

### vertices: array[object]

This supports the `polygon` type.

#### x: number(float-one-minus-one)

Horizontal coordinate of this vertex.  One and minus one are the
extents of the icon and must not be exceeded.

#### y: number(float-one-minus-one)

Horizontal coordinate of this vertex.  One and minus one are the
extents of the icon and must not be exceeded.

## items: object{object}

Streya has many personal items that can be worn, weilded or carried
by characters.  Each of these items requires a definition.  Note
that the definition isn\'t the item itself, which may have modifiers
that impact it.  Instead this is a template of properties that are
used when the item doesn\'t override them.

### mass: required number(positive-float)

Mass of the item in grams.

### volume: number(positive-float)

When not `undefined` indicates a continuous material, like a liquid
or sand.  Measured in liters.

### slot: string(slot-type)

When present indicates that the item can be worn in the specified
slot.  For example, a hat might have `{ "slot": "head", ... }` to
indicate it can be worn on the head.

### storeVolume: number(positive-float)

Indicates that the item can store up to the specified volume in
liters of some liquid.

### storeBulk: number(non-negative-integer)

When present indicates that the item can store up to `storageSlots`
items with a bulk up to and including the value.

### storeCount: number(positive-integer)

When present indicates that the item can store a number of items
with up to `storageBulk` bulk equal to the value.

### storeSlots: object{number(non-negative-integer))}

When present indicates that the item can accept items with a
particular slot value.  For example, a `scabbard` item might have `{
"storeSlots": {"sword": 1}, ... }` which would allow it to accept a
sword.

### bulk: number(non-negative-integer)

Represents how challenging it is to carry and use the item.  Items
with bulk greater than three cannot be worn.  Items with bulk greater
than five cannot be carried without assistance.

  - `0`: Small items like coins and key cards that fit in pockets
  - `1`: Easy to wield in one hand, such as a knife
  - `2`: Possible to wield in one hand, like an axe
  - `3`: Easy to wield with two hands, but possible to use with one
  - `4`: Requires two hands to wield
  - `5`: Requires two hands to wield and carry

### attacks: object{object}

Some items can be used as weapons.  These have one or more attacks
specified in this object.

Attacks begin at some point in time and land after the windup expires.
After this the attacking character must continue until the cooldown
expires or until they are incapacitated in some other way.

#### difficulty: number(positive-integer)

This number is the target for an attack to hit an inanimate object
about the size of a person.  Attacks that don't reach this number
are effectively fumbles.

#### damage: required object{positive-integer}

Each key in damage object specifies a damage type.  Possible damage
types are:

  - Blunt: damage caused by impact
  - Point: focuses force on a small area
  - Edge: cleaves along an edge
  - Fire: extreme heat that causes burns
  - Acid?
  - Cold?

#### windup: required number(positive-float)

This is the time between selecting the attack and having it take
effect.  The value is measured in seconds.  This is a crucial tool
for balancing.

#### cooldown: required number(positive-float)

This is the time between an attack taking effect and the character
being free to perform some other action.  The value is measured in
seconds.  This is a crucial tool for balancing.

#### reach: number(positive-float)

When not `undefined` this attack can be used to strike another
character with the item.  The value of this field (measured in meters)
plus the reach of the character doing the striking determines the
distance at which the attack can be used effectively.

#### range: float(positive-float)

When not `undefined` this item can be thrown.  The value of this field
(measured in meters) determines the distance at which the attack can
be used effectively.  If this item has no defined `ammo` field then
using this attack removes the item from the inventory of the character
and places it in the cell occupied by the target.

#### ammo: string

When not `undefined` this is a reference to the definition of an item
required to perform this attack.  A character performing this attack
must have an item with the corresponding tag their inventory, which is
removed when resolving the attack.

:TODO: some ammo is destroyed upon use -- how to represent this?

### defense: number(non-negative-integer)

When truthy this item can be used to block or parry attacks.

### ignore: boolean

When present and truthy, this item is rendered invisible to players.
It can still be used for existing content.

## races: object{object}

Each character has a race.  The default is `human` but there may be
other options.

### slots: object{???}

:TODO: expand

### ignore: boolean

When present and truthy, this race is rendered invisible to players.
It can still be used for existing content.

## cultures: object{object}

A culture comprises customs, language and the way things are named.

:TODO: expand

### ignore: boolean

When present and truthy, this culture is rendered invisible to players.
It can still be used for existing content.

## backgrounds: object{object}

A culture comprises customs, language and the way things are named.

:TODO: expand

### ignore: boolean

When present and truthy, this background is rendered invisible to
players.  It can still be used for existing content.

## facilities: object{object}

A facility is a static structure that can be placed in a building or
a ship.  These can be used by characters to meet needs, excercise
skills or influence ship activities.

### ignore: boolean

When present and truthy, this facility is rendered invisible to players.
It can still be used for existing content.

## gestalt: object{object}

Each instance of Streya is called a gestalt.  No single program should
concern itself with more than one gestalt at a time.  Whether gestalts
will ever have any means of interacting is an open question.

Gestalt names will usually be long strings of hexidecimal characters,
which can be used as seeds for pseudo-random number generators.  When
in doubt, use `default` as the name of the gestalt.  This will usually
contain a redirect.

### redirect: string

When present, this indicates that the gestalt is actually a reference
to something else, which should be looked up and used instead.  This is
like a symbolic link.

### items: object

A gestalt may have its own optional item definition object.  If present
the definitions in it override those found in the top level instance.
All fields from the top level `items` object apply here.

### races: object

A gestalt may have its own optional race definition object.  If present
the definitions in it override those found in the top level instance.
All fields from the top level `races` object apply here.

### stations: object

A gestalt usually has several stations.  These are enormous ships that
rotation for gravity to support populations.  Stations almost never
move, since this would require massive engines and economically
ruinious quantities of fuel.  Instead, resources are brought to them
by mining and trade ships, which can purchase refined supplies.

#### districtRows: number(positive-integer)

Number of districts in one row of the station.  Because rotation is
around an axis parallel to a row, there must be at least six districts
in each row.  Adding rows to a station is especially difficult since
the rotation would have to be slowed or even stop entirely during
construction.

#### districtCols: number(positive-integer)

Number of districts in one column of the station.  Because rotation
is around an axis perpendicular to a column, adding columns to a
station is usually easier than adding rows.

#### districts: object

Each district is described by a member of this object.

### ships: object

A gestalt will usually have lots of ships.  These are mobile habitats
with fusion reactors and engines that serve a variety of purposes.

Common ship purposes include:

  - Mining: these ships travel to asteroids to collect resources.
  - Merchant: these ships buy refined goods where they\'re cheap
    and sell them where they\'re expensive.
  - Pirate: these ships prey upon and plunder poorly defended
    ships of other types
  - Privateer: these ships engage pirates and engage in bounty
    hunting missions.
  - Millitary: these are usually heavily armed ships that impose
    state authority on other ships
    
Ships normally travel in three phases:

  - Acceleration: thrust (which creates gravity) toward a destination.
  - Deceleration: thrust (which creates gravity) away from a destination
    to match relative speed on arrival.
  - Cruise: free fall to take advantage of velocity between
    acceleration and deceleration phases.

#### cells: object

Contains a reference to the contents of a ship at a specified index.

  - Hull: about a meter of ice surrounded by aluminium to shield crew
    from neutron radiation.
  - Floor: empty interior space to facilitate crew movement
  - System: one part of a ship system

#### facilities: object

Components of a ship.
