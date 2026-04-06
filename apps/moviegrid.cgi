#! /usr/bin/env python3
import os
import re
import csv
from datetime import datetime, time, timedelta
from io import StringIO
from flask import Flask, make_response, request, render_template_string

app = Flask(__name__)

TEXT_COLOR = '#1f3242'

FIXED_COLORS = {
    'Documentary': '#F1BA40',
    'Narrative': '#C1BF8E',
    'Shorts Package': '#CCB8C6',
    'Free Thing': '#EA8186' }

COLORS = [
    '#003366', '#006400', '#800000', '#4B0082',
    '#008080', '#000080', '#556B2F', '#2F4F4F',
    '#8B4513', '#B22222' ]

# Valid theaters
VALID_THEATERS = (
    'Somerville Theater 1',
    'Somerville Theater 2',
    'Somerville Theater 3',
    'Brattle Theater',
    'Coolidge Corner 1' )

HTML_TEMPLATE = '''
<!DOCTYPE html>
<title>&#x1F3AC; Movie Grid Generator</title>
<style>
  body { font-family: Arial, sans-serif; margin: auto 5%; }
  .container { max-width: 1200px; margin: auto; }
  textarea { width: 100%; font-family: monospace; }
  input[type="file"] { margin: 10px 0; }
  button { padding: 10px 20px; background: #4CAF50; color: white;
           border: none; cursor: pointer; }
  button:hover { background: #45a049; }
  .error { color: red; margin: 10px 0; }
  .tab { border: 1px solid #ccc; background-color: #f1f1f1;
         overflow: hidden; }
  .tab button { background-color: inherit; float: left; border: none;
                outline: none; cursor: pointer; padding: 14px 16px;
                transition: 0.3s; color: black; }
  .tab button:hover { background-color: #ddd; }
  .tab button.active { background-color: #ccc; }
  .tabcontent { display: none; padding: 20px; border: 1px solid #ccc;
                border-top: none; }
</style>
<div class="container">
<h1>&#x1F3AC; Movie Grid Generator</h1>

{% if error %}
<div class="error">{{ error }}</div>
{% endif %}

{% for key in svgs.keys() %}
  <div style="margin-top: 30px;">
    {{ svgs[key]|safe }}
  </div>
  <button id="download_svg_{{ key }}">Download SVG</button>
{% endfor %}

<div class="tab">
  <button class="tablinks" onclick="openTab(event, 'Paste')"
          id="defaultOpen">Paste CSV</button>
  <button class="tablinks" onclick="openTab(event, 'Upload')">
    Upload CSV File
  </button>
</div>

<div id="Paste" class="tabcontent">
  <form method="post" action="{{ base_path }}/generate">
    <h3>Paste CSV Data</h3>
    <textarea name="csv_data" rows="5">
Event,Film Start Date,Event Start Time,Runtime,Category,Venue,Screen
Movie1,18-Apr-2026,14:30,120,Action,Brattle Theater,
Movie2,18-Apr-2026,16:00,90,Comedy,Coolidge Corner,1
Movie3,18-Apr-2026,15:05,105,Drama,Somerville Theater,1</textarea>
    <br /><br />
    <label>
      Wrap Length <input type="text" size="4" name="wrap" value="18" />
    </label><br />
    <label>
      Merge Height <input type="text" size="4"
                          name="merge" value="27" />
    </label><br />
    <button type="submit">Generate SVG</button>
  </form>
</div>

<div id="Upload" class="tabcontent">
  <form method="post" action="{{ base_path }}/generate"
        enctype="multipart/form-data">
    <h3>Upload CSV File</h3>
    <input type="file" name="csv_file" accept=".csv">
    <br /><br />
    <label>
      Wrap Length <input type="text" size="4" name="wrap" value="18" />
    </label><br />
    <label>
      Merge Height <input type="text" size="4"
                          name="merge" value="27" />
    </label><br />
    <button type="submit">Generate SVG</button>
  </form>
</div>

<script>
  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

{% for key in svgs.keys() %}
  const svg_{{ key }} = {{ svgs[key]|tojson }};
  document.getElementById('download_svg_{{ key }}')
          .addEventListener("click", event => {
    download('movie-grid-{{ key }}', new Blob(
      [svg_{{ key }}], { type: 'image/svg+xml' }));
  });
{% endfor %}

  function openTab(event, tabName) {
    var ii, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (ii = 0; ii < tabcontent.length; ++ii)
      tabcontent[ii].style.display = "none";
    tablinks = document.getElementsByClassName("tablinks");
    for (ii = 0; ii < tablinks.length; ++ii)
      tablinks[ii].className =
        tablinks[ii].className.replace(" active", "");
    document.getElementById(tabName).style.display = "block";
    event.currentTarget.className += " active";
  }
  document.getElementById("defaultOpen").click();
</script>
'''

def parse_time(time_str):
    """Parse time string in HH:MM format"""
    result = None
    try:
        result = datetime.strptime(time_str.strip(), '%I:%M%p').time()
    except ValueError:
        result = datetime.strptime(time_str.strip(), '%H:%M').time()
    return result;

def parse_date(date_str):
    """Parse date string in DD-MMM-YYYY format (e.g., 18-Apr-2026)"""
    result = None
    try:
        result = datetime.strptime(date_str.strip(), '%m/%d/%Y')
    except ValueError:
        result = datetime.strptime(date_str.strip(), '%d-%b-%Y')
    return result

def parse_runtime(runtime_str):
    """Parse runtime as integer minutes"""
    return int(runtime_str.strip())

def wrap_text(text, wrap):
    result = []
    if wrap is not None:
        text = text.strip()
        while text and len(text) > wrap:
            idx = text[:wrap].rfind(' ')
            if idx > 0:
                result.append(text[:idx])
                text = text[idx:].strip()
            else: break
        if text: result.append(text)
    else: result.append(text)
    return result

def movie_text_svg(title, start_time, runtime, color, x, y,
                   wrap=18, merge=27, ind='  '):
    """Create a set of SVG text elements to dispay the title,
    start time and runtime of a movie.  Long titles are wrapped.
    Start time and runtime are consolidated when the runtime
    is relatively short but given their own lines otherwise."""
    result = []
    return result

def generate_svg(movies, when, wrap, merge):
    """Generate SVG visualization from movies data"""

    if not movies:
        return ''.join(('<svg width="800" height="200">',
                        '<text x="10" y="20">',
                        'Movie list is empty',
                        '</text>', '</svg>'))

    theaters = {theater: [] for theater in VALID_THEATERS}
    for movie in movies:
        if not when or when == movie['date']:
            theaters[movie['theater']].append(movie)
    modified = {}
    for idx, theater in enumerate(VALID_THEATERS):
        if len(theaters[theater]) > 0:
            modified[theater] = theaters[theater]
    theaters = modified

    all_times = []
    category_colors = {}
    n_colors = 0;

    for theater_movies in theaters.values():
        for movie in theater_movies:
            start_time = datetime.combine(
                datetime.today(), movie['start_time'])
            end_time = start_time + timedelta(
                minutes=movie['runtime'])
            all_times.append(start_time)
            all_times.append(end_time)

            if movie['category'] in FIXED_COLORS:
                pass
            elif not movie['category'] in category_colors:
                category_colors[movie['category']] = \
                    COLORS[n_colors % len(COLORS)]
                n_colors += 1

    if not all_times:
        return ''.join(('<svg width="800" height="200">',
                        '<text x="10" y="20">', 'No valid movies',
                        '</text>', '</svg>'))

    min_time = (min(all_times) - timedelta(minutes=15)).replace(
        minute=0, second=0, microsecond=0)
    max_time = max(all_times) + timedelta(minutes=15)
    if (max_time.minute > 0 or max_time.second > 0 or
        max_time.microsecond > 0):
        max_time = (max_time.replace(minute=0, second=0, microsecond=0)
                    + timedelta(hours=1))
    total_minutes = (max_time - min_time).total_seconds() / 60

    time_label_width = 60
    theater_width  = 64
    theater_height = 40
    banner_height  = 40
    header_height  = banner_height + theater_height
    svg_height = header_height + total_minutes * 0.4167
    svg_width  = time_label_width + len(theaters) * theater_width + \
        3 * (len(theaters) - 1) + 2

    svg = [f'<svg xmlns="http://www.w3.org/2000/svg"',
           f'     width="{svg_width}" height="{svg_height}"',
           f'     style="background-color: #e1e1e1;">']

    svg.append('<g>') # grid and time labels
    current_minute = 0

    while current_minute <= total_minutes:
        y = header_height + current_minute * 0.4167
        current_time = min_time + timedelta(minutes=current_minute)

        if (current_minute < total_minutes):
            time_label = current_time.strftime('%-I%p').lower()
            svg.extend([
                f'  <text x="5" y="{y+5}" font-size="12" ',
                f'        fill="{TEXT_COLOR}">{time_label}</text>'])
        svg.extend([
            f'  <line x1="{time_label_width}" y1="{y}"',
            f'        x2="{svg_width}" y2="{y}"',
            f'        stroke="#aaa" stroke-width="1"/>'])
        current_minute += 60

    banner = when.strftime("%d %B %Y") if when is not None \
        else "Movies"
    banner_x = time_label_width + (svg_width - time_label_width) / 2
    svg.extend([
        f'  <rect x="{time_label_width}" y="0" fill="#f5f5f5"',
        f'        stroke="#ccc" stroke-width="1"',
        f'        width="{svg_width - time_label_width}"',
        f'        height="{banner_height}" />',
        f'  <text x="{banner_x}" y="{banner_height * 5 / 8}"',
        f'        fill="{TEXT_COLOR}"',
        f'        font-family="Montserrat" text-anchor="middle">',
        f'    {banner}</text>',
        f'  <line x1="{time_label_width}" y1="0"',
        f'        x2="{time_label_width}" y2="{svg_height}"',
        f'        stroke="#ccc" stroke-width="1"/>'])
    for idx, theater in enumerate(theaters):
        x = time_label_width + idx * theater_width + 3 * idx
        y = header_height - theater_height
        svg.extend([
            f'  <rect x="{x}" y="{y}" fill="#f5f5f5"',
            f'        stroke="#ccc" stroke-width="1"',
            f'        width="{theater_width + 2}"',
            f'        height="{theater_height}" />'])
        parts = wrap_text(theater, 12)
        text_x = x + theater_width / 2
        text_y = y + theater_height/(len(parts) + 1) + 5
        for part in parts:
            svg.extend([
                f'  <text font-weight="bold" font-size="9"',
                f'        x="{text_x}" y="{text_y}"',
                f'        fill="{TEXT_COLOR}" font-family="Montserrat"',
                f'        text-anchor="middle">',
                f'        {part}</text>'])
            text_y += 10
        svg.extend([
            f'  <line x1="{x + theater_width + 2}"',
            f'        y1="{theater_height}"',
            f'        x2="{x + theater_width + 2}" y2="{svg_height}"',
            f'        stroke="#ccc" stroke-width="1"/>'])
    svg.append('</g>')

    for idx, theater in enumerate(theaters):
        x = time_label_width + idx * theater_width + 3 * idx + 1
        for movie in theaters[theater]:
            start_datetime = datetime.combine(
                datetime.today(), movie['start_time'])
            minutes_from_start = \
                (start_datetime - min_time).total_seconds() / 60
            y = header_height + minutes_from_start * 0.4167
            height = movie['runtime'] * 0.4167

            if movie['category'] in FIXED_COLORS:
                color = FIXED_COLORS[movie['category']]
            else: color = category_colors[movie['category']]

            svg.append('<g>')

            # Each movie rectangle is based on start time and runtime
            svg.append(f'  <rect x="{x}" y="{y}" fill="{color}"')
            svg.append(f'        width="64" height="{height}"')
            svg.append(f'        opacity="1.0" />')

            parts = wrap_text(movie["title"], wrap)
            str_start   = movie["start_time"].strftime(
                "%-I:%M%p").lower()
            str_runtime = f"{movie['runtime']}min"
            if movie["runtime"] > merge * (len(parts) + 2):
                parts.append(str_start)
                parts.append(str_runtime)
            else: parts.append(f"{str_start}, {str_runtime}")

            text_y = y + 10
            for part in parts:
                svg.extend([
                    f'  <text x="{x + 3}" y="{text_y}" ' +
                    f'fill="{TEXT_COLOR}"',
                    f'        text-anchor="left" font-size="9"',
                    f'        font-family="Barlow Condensed"',
                    f'        font-weight="600">',
                    f'    {part}', '  </text>'])
                text_y += 10

            svg.append('</g>')

    svg.append('</svg>')
    return '\n'.join(svg)

@app.route('/')
def index():
    return render_template_string(
        HTML_TEMPLATE, error=None, svgs={})

@app.route('/generate', methods=['POST'])
def generate():
    csv_content = None

    if ('csv_file' in request.files and
        request.files['csv_file'].filename):
        csv_file = request.files['csv_file']
        csv_content = csv_file.read().decode('utf-8-sig')
    elif 'csv_data' in request.form and request.form['csv_data']:
        csv_content = request.form['csv_data'].strip()

        if not csv_content:
            return render_template_string(
                HTML_TEMPLATE, error="Please provide CSV data",
                svgs={})

    movies = []
    try:
        csv_reader = csv.DictReader(StringIO(csv_content))
        required_columns = {
            'Event', 'Film Start Date', 'Event Start Time',
            'Runtime', 'Category', 'Venue', 'Screen' }
        found_columns = set(csv_reader.fieldnames) or []
        if not required_columns.issubset(found_columns):
            missing = ', '.join(required_columns - found_columns)
            extra = ', '.join(found_columns - required_columns)
            return render_template_string(
                HTML_TEMPLATE, error=f"CSV is missing {missing} " +
                f"but has extra {extra}", svgs={})

        dates = set()

        for row_num, row in enumerate(csv_reader, start=2):
            try:
                theater = (f"{row['Venue']} {row['Screen']}" if
                           row['Screen'] else row['Venue']).strip()
                if theater not in VALID_THEATERS:
                    valid = ', '.join(VALID_THEATERS)
                    return render_template_string(
                        HTML_TEMPLATE, 
                        error=f"Row {row_num}: Unknown theater " +
                        f"'{theater}'. Valid theaters: {valid}",
                        svgs={})

                date = parse_date(row['Film Start Date'])
                dates.add(date)

                movies.append({
                    'title': row['Event'].strip(), 'date': date,
                    'start_time': parse_time(row['Event Start Time']),
                    'runtime': parse_runtime(row['Runtime']),
                    'category': row['Category'].strip(),
                    'theater': theater })
            except Exception as e:
                return render_template_string(
                    HTML_TEMPLATE, 
                    error=f"Row {row_num}: Error parsing data - {str(e)}",
                    svgs={})

        if not movies:
            return render_template_string(
                HTML_TEMPLATE, error="No valid movies found in CSV",
                svgs={})

        wrap = 18
        if 'wrap' in request.form and request.form['wrap']:
            wrap = int(request.form['wrap'])
        merge = 27
        if 'merge' in request.form and request.form['merge']:
            merge = int(request.form['merge'])

        svgs = {}
        for date in sorted(dates):
            svgs[date.strftime('%d_%b_%Y')] = \
                generate_svg(movies, date, wrap, merge);

        response = make_response(render_template_string(
            HTML_TEMPLATE, error=None, svgs=svgs))
        response.headers['Content-Type'] = 'text/html'
        return response

    except Exception as e:
        return render_template_string(
            HTML_TEMPLATE,
            error=f"Error processing CSV: {str(e)}", svgs={})

def is_cgi():
    return os.environ.get('GATEWAY_INTERFACE', '').startswith('CGI/')

def base_path():
    result = ''
    if is_cgi():
        result = os.environ.get('SCRIPT_NAME', '')
    return result

@app.context_processor
def context_processor():
    """Make base path available in templates"""
    return {
        'base_path': base_path(),
        'is_cgi': is_cgi }

if __name__ == '__main__':
    if is_cgi():
        from wsgiref.handlers import CGIHandler
        CGIHandler().run(app)
    else: app.run(host='0.0.0.0', port=5000, debug=True)
