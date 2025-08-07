#! /usr/bin/env wish
package require Tk

set width 600
set height 400
set ship_size 20
set bullet_speed 10
set turn_speed 10
set move_speed 5

set ship_x [expr $width / 2]
set ship_y [expr $height / 2]
set ship_angle 0
set bullets {}
set game_over 0

canvas .c -width $width -height $height -bg black
pack .c

.c create text 300 100 \
    -text "Asteroids" \
    -fill white -font {Arial 24} -tag title

proc draw_ship {} {
    global ship_x ship_y ship_angle ship_size
    set x1 [expr $ship_x + $ship_size * cos($ship_angle)]
    set y1 [expr $ship_y + $ship_size * sin($ship_angle)]
    set x2 [expr $ship_x + $ship_size * cos($ship_angle + 2.094)]
    set y2 [expr $ship_y + $ship_size * sin($ship_angle + 2.094)]
    set x3 [expr $ship_x + $ship_size * cos($ship_angle - 2.094)]
    set y3 [expr $ship_y + $ship_size * sin($ship_angle - 2.094)]
    .c delete ship
    .c create polygon $x1 $y1 $x2 $y2 $x3 $y3 -fill white -tag ship
}

proc move_ship {} {
    global ship_x ship_y ship_angle move_speed width height
    set ship_x [expr $ship_x + $move_speed * cos($ship_angle)]
    set ship_y [expr $ship_y + $move_speed * sin($ship_angle)]
    if {$ship_x < 0} {set ship_x $width}
    if {$ship_x > $width} {set ship_x 0}
    if {$ship_y < 0} {set ship_y $height}
    if {$ship_y > $height} {set ship_y 0}
    draw_ship
}

proc rotate_ship {direction} {
    global ship_angle turn_speed
    set ship_angle [expr $ship_angle + $direction * $turn_speed * 0.0174533]
    draw_ship
}

proc shoot {} {
    global ship_x ship_y ship_angle bullets bullet_speed
    lappend bullets [list $ship_x $ship_y $ship_angle]
    play_sound sounds/shoot-beam.ogg
}

proc move_bullets {} {
    global bullets bullet_speed width height
    set new_bullets {}
    foreach bullet $bullets {
        lassign $bullet x y angle
        set x [expr $x + $bullet_speed * cos($angle)]
        set y [expr $y + $bullet_speed * sin($angle)]
        if {$x >= 0 && $x <= $width && $y >= 0 && $y <= $height} {
            lappend new_bullets [list $x $y $angle]
        }
    }
    set bullets $new_bullets
    draw_bullets
}

proc draw_bullets {} {
    global bullets
    .c delete bullet
    foreach bullet $bullets {
        lassign $bullet x y angle
        .c create oval [expr $x-5] [expr $y-5] [expr $x+5] [expr $y+2] \
            -fill yellow -tag bullet
    }
}

proc play_sound {filename} {
    if {[file exists $filename]} {
        exec ogg123 $filename &
    }
}

proc game_over {} {
    global game_over
    set game_over 1
    .c create text 300 200 -text "Game Over" \
        -fill red -font {Arial 36} -tag game_over
}

proc game_loop {} {
    global game_over
    if {!$game_over} {
        move_ship
        move_bullets
        after 50 game_loop
    }
}

bind . <KeyPress-Left> {rotate_ship -1}
bind . <KeyPress-Right> {rotate_ship 1}
bind . <KeyPress-Up> {move_ship}
bind . <KeyPress-space> {shoot}
draw_ship
game_loop
