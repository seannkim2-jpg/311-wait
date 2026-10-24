# Civic Action portal dataset inventory

Source: https://hackachusetts2026.vercel.app/#/civic
Starter kit: https://hackachusetts2026.vercel.app/kits/tracks/civic.zip
Snapshot saved: 2026-10-18. The six-row site previews are illustrative; use live APIs for current transit information.

## Track directions

- Better Together: improving where we live, work, study and play
- Citizen-Friendly Digital Government
- More Responsive Neighborhood Services
- Stronger Community Emergency Readiness

## Challenges

- V1 Simplified public services
- V2 Responsive and resilient communities
- V3 Safer and connected places
- V4 Better college experiences
- V5 Pathways to education and opportunity

## Datasets (all 22)

### Boston 311 service requests (boston-311)
- Type: dataset; challenges: v2
- Portal use: Neighborhood service patterns and triage.
- Scope: Topic, department, status, neighborhood. No street address.
- Starter snapshot: 5000 rows; columns: open_date, case_topic, service_name, assigned_department, case_status, neighborhood, zip_code, on_time, city_council_district, ward.
- Preview: 8 rows; 8 of 71,934 cases. No street address.
- Direct source: https://data.boston.gov/api/3/action/datastore_search?resource_id=254adca6-64ab-4c5c-9fc0-a6da622be185&fields=open_date,case_topic,service_name,assigned_department,case_status,neighborhood,zip_code,on_time,city_council_district,ward&sort=open_date%20desc&limit=100

### MBTA service alerts (mbta-alerts)
- Type: api; challenges: v3
- Portal use: Disruption communication and trip decisions.
- Scope: Effect, severity, routes, rider text.
- Starter snapshot: 130 rows; columns: updated, effect, severity, routes, header.
- Preview: 6 rows; 6 alerts. Severity is 1–10.
- Direct source: https://api-v3.mbta.com/alerts?page%5Blimit%5D=50

### MBTA subway routes (mbta-routes)
- Type: api; challenges: v3
- Portal use: Transit navigation and routing context.
- Scope: Subway and light rail.
- Starter snapshot: 8 rows; columns: id, name, mode, fare_class.
- Preview: 8 rows; Subway and light rail.
- Direct source: https://api-v3.mbta.com/routes?filter%5Btype%5D=0,1

### MBTA rapid transit stations (mbta-stations)
- Type: dataset; challenges: v3
- Portal use: Station-level transit context on a map.
- Scope: Station and line. No geometry.
- Starter snapshot: 170 rows; columns: station, line, route.
- Preview: 8 rows; No geometry.
- Direct source: https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/MBTA_Rapid_Transit/MapServer/0/query?where=1%3D1&outFields=STATION,LINE,ROUTE&returnGeometry=false&f=json

### MassGIS environmental justice block groups (civic-ej)
- Type: dataset; challenges: v1,v2
- Portal use: Equity context for services, neighborhoods, and alerts.
- Scope: Block groups flagged for income, race, or language.
- Starter snapshot: 2604 rows; columns: municipality, population, minority_pct, limited_english_hh_pct, block_group_income, ej, criteria.
- Preview: 6 rows; 6 block groups flagged Yes. Income is the block-group median.
- Direct source: https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/EJ2020/MapServer/0/query?where=EJ%3D%27Yes%27&outFields=MUNICIPALITY,TOTAL_POP,PCT_MINORITY,LIMENGHHPCT,BG_MHHI,EJ,EJ_CRIT_DESC&returnGeometry=false&resultRecordCount=100&f=json

### OpenFEMA disaster declarations (fema)
- Type: api; challenges: v2
- Portal use: Emergency readiness and disaster history.
- Scope: Massachusetts declarations.
- Starter snapshot: 415 rows; columns: declarationDate, disasterNumber, incidentType, declarationTitle, designatedArea, declarationType.
- Preview: 6 rows; Latest Massachusetts declarations.
- Direct source: https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state%20eq%20%27MA%27&$top=100&$select=disasterNumber,declarationTitle,declarationDate,incidentType,designatedArea,declarationType&$orderby=declarationDate%20desc

### Boston approved building permits (permits)
- Type: dataset; challenges: v1
- Portal use: Permitting volume, type, and ward.
- Scope: Issued since 2024. No street address.
- Starter snapshot: 8240 rows; columns: permitnumber, worktype, permittypedescr, description, declared_valuation, total_fees, issued_date, expiration_date, status, occupancytype, sq_feet, zip, ward.
- Preview: 6 rows; 6 of 8,240 Boston permits issued since 2024. No street address.
- Direct source: https://data.boston.gov/api/3/action/datastore_search_sql?sql=SELECT%20permitnumber%2Cworktype%2Cpermittypedescr%2Cdescription%2Cdeclared_valuation%2Ctotal_fees%2Cissued_date%2Cexpiration_date%2Cstatus%2Coccupancytype%2Csq_feet%2Czip%2Cward%20FROM%20%226ddcd912-32a0-43df-9908-63574f8c7e77%22%20WHERE%20issued_date%20%3E%3D%20%272024-01-01%27%20ORDER%20BY%20issued_date%20DESC%20LIMIT%20100

### Boston neighborhood estimates, 2025 (neighborhoods)
- Type: dataset; challenges: v1
- Portal use: Who lives where, before a service is designed.
- Scope: Population, education, poverty. City estimates.
- Starter snapshot: 24 rows; columns: neighborhood, year, land_sqmi, population, hs_or_ged, bachelors, graduate_degree, poverty_universe, poverty_count.
- Preview: 6 rows; 6 of 24 neighborhoods. 2025 city estimates from ACS tables.
- Direct source: https://data.boston.gov/api/3/action/datastore_search_sql?sql=SELECT%20name%2Cyear%2Carealand_sqmi%2Cpopulation_b01001_001e%2Ceducation_b15003_hsgrad_and_ged%2Ceducation_b15003_022e%2Ceducation_b15003_gradprofdegree%2Cincome_b17001_001e%2Cincome_b17001_002e%20FROM%20%22b0543358-d03f-4682-bf0c-658ea4573d6f%22

### Boston building and property violations (violations)
- Type: dataset; challenges: v1
- Portal use: Where permits and inspections pile up.
- Scope: Status since 2024. No street address.
- Starter snapshot: 2018 rows; columns: case_no, status_date, status, code, value, description, city, zip, ward.
- Preview: 6 rows; 6 of 2,018 Boston violations with a status since 2024. No street address.
- Direct source: https://data.boston.gov/api/3/action/datastore_search_sql?sql=SELECT%20case_no%2Cstatus_dttm%2Cstatus%2Ccode%2Cvalue%2Cdescription%2Cviolation_city%2Cviolation_zip%2Cward%20FROM%20%22800a2663-1d6a-46e7-9356-bedb70f5332c%22%20WHERE%20status_dttm%20%3E%3D%20%272024-01-01%27%20ORDER%20BY%20status_dttm%20DESC%20LIMIT%20100

### College Scorecard, Massachusetts (scorecard)
- Type: dataset; challenges: v1,v5
- Portal use: Comparing what a college costs and what students earn later.
- Scope: Cost, debt, earnings, and completion. Suppressed cells stay suppressed.
- Starter snapshot: 140 rows; columns: unitid, name, city, control, highest_degree, admission_rate, undergraduates, net_price_public, net_price_private, cost, in_state_tuition, median_debt, earnings_10yr, completion_4yr, completion_under_4yr.
- Preview: 6 rows; 6 of 140 Massachusetts institutions. College Scorecard, 15 Oct 2026. Suppressed cells stay blank or marked.
- Direct source: https://ed-public-download.scorecard.network/downloads/Most-Recent-Cohorts-Institution_10152026.zip

### O*NET occupations (onet)
- Type: dataset; challenges: v1,v5
- Portal use: Connecting a skill or a major to a career name.
- Scope: Occupation titles and descriptions from O*NET 30.0.
- Starter snapshot: 1016 rows; columns: code, title, description.
- Preview: 6 rows; 6 of 1,016 O*NET 30.0 occupations. Not a list of open jobs.
- Direct source: https://www.onetcenter.org/dl_files/database/db_30_0_text/Occupation%20Data.txt

### IPEDS institutional directory, Massachusetts (ipeds)
- Type: dataset; challenges: v2,v4,v5
- Portal use: A fact book of campuses, sector, and size.
- Scope: Every Massachusetts institution in the 2024 IPEDS directory.
- Starter snapshot: 144 rows; columns: unitid, name, city, sector, level, control, hbcu, size, website, latitude, longitude.
- Preview: 6 rows; 6 of 144 Massachusetts institutions in the 2024 IPEDS directory.
- Direct source: https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip

### OpenAlex works at the nine campuses, 2024 (openalex-works)
- Type: api; challenges: v2,v4
- Portal use: Finding research already happening where students are.
- Scope: Most-cited 2024 works with an author at a Hackachusetts campus.
- Starter snapshot: 500 rows; columns: title, year, type, cited_by, source.
- Preview: 6 rows; 6 of 500 most-cited 2024 works at the nine campuses. Not the full OpenAlex result.
- Direct source: https://api.openalex.org/works?filter=authorships.institutions.id:I63966007%7CI136199984%7CI103531236%7CI111088046%7CI12912129%7CI24603500%7CI133738476%7CI33434090%7CI96062909,publication_year:2024&sort=cited_by_count:desc&per_page=25&select=display_name,publication_year,cited_by_count,type,primary_location

### MassGIS colleges and universities (colleges)
- Type: dataset; challenges: v3
- Portal use: Seeing which campuses a bus, a bike, or a service can reach.
- Scope: Campus points statewide. Street address and phone are left out.
- Starter snapshot: 206 rows; columns: college, campus, city, zip, town, type, level, category, housing, latitude, longitude.
- Preview: 6 rows; 6 of 206 MassGIS college points. Street address left out.
- Direct source: https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/HigherEd/MapServer/0/query?where=1%3D1&outFields=COLLEGE,CAMPUS,CITY,ZIPCODE,GEOG_TOWN,TYPE,NCES_TYPE,CATEGORY,CAMPUSHOUS&returnGeometry=true&outSR=4326&f=json

### Bluebikes trips, November 2024 (bluebikes)
- Type: dataset; challenges: v3
- Portal use: Where shared bikes actually move around campus.
- Scope: Station-to-station counts for one month. The URL is every trip.
- Starter snapshot: 63063 rows; columns: start_station, end_station, trips, member_trips, casual_trips.
- Preview: 6 rows; 6 of 63,063 station pairs. November 2024 Bluebikes trips, counted. The URL is every trip.
- Direct source: https://s3.amazonaws.com/hubway-data/202411-bluebikes-tripdata.zip

### Boston Vision Zero crash records (vision-zero)
- Type: dataset; challenges: v3
- Portal use: Finding injury patterns near a campus or a bike route.
- Scope: Mode, street, and cross street. The city's crash point, not a home.
- Starter snapshot: 44986 rows; columns: when, mode, where, street, cross_street, cross_street_2, latitude, longitude.
- Preview: 6 rows; 6 of 44,986 Boston Vision Zero crashes. Not the state crash file.
- Direct source: https://data.boston.gov/api/3/action/datastore_search?resource_id=e4bfe397-6bfc-49c5-9367-c879fac7401d&fields=dispatch_ts,mode_type,location_type,street,xstreet1,xstreet2,lat,long&sort=dispatch_ts%20desc&limit=100

### Cambridge police crash records (cambridge-crashes)
- Type: dataset; challenges: v3
- Portal use: Intersections where people walking or biking get hit.
- Scope: Street and crash type. No house number, plate, age, or sex.
- Starter snapshot: 17230 rows; columns: when, day, street, cross_street, near_street, cyclist, pedestrian, manner, first_event, light, weather, road, speed_limit, at, latitude, longitude.
- Preview: 6 rows; 6 of 17,230 Cambridge crashes. No house number, plate, age, or sex.
- Direct source: https://data.cambridgema.gov/resource/gb5w-yva3.json?$select=date_time,day_of_week,street_name,cross_street,near_street,location,may_involve_cyclist,may_involve_pedestrian,manner_of_collision,first_harmful_event,ambient_light,weather_condition_1,road_surface_condition,speed_limit,street_or_intersection&$order=date_time%20DESC&$limit=100

### Cambridge citywide bicycle counts (cambridge-bikes)
- Type: dataset; challenges: v3
- Portal use: Which streets already carry bike traffic.
- Scope: Counts since 2018 at named locations.
- Starter snapshot: 92268 rows; columns: location, year, date, period, street, direction, where, movement, count, weather, latitude, longitude.
- Preview: 6 rows; 6 of 92,268 Cambridge bicycle counts from 2018 on.
- Direct source: https://data.cambridgema.gov/resource/ijm6-q7em.json?$select=countlocation,year,date,timeperiod,street,trafficdirection,cyclistlocation,movementtype,count,weather,latitude,longitude&$where=year%20%3E=%20%272018%27&$order=date%20DESC&$limit=100

### Cambridge Broadway bicycle counter (eco-totem)
- Type: dataset; challenges: v3
- Portal use: Season and time of day on one real bike street.
- Scope: Automated Broadway counts from 2024 on.
- Starter snapshot: 17123 rows; columns: when, day, total, entries, exits.
- Preview: 6 rows; 6 of 17,123 Broadway counter rows from 2024 on. One counter.
- Direct source: https://data.cambridgema.gov/resource/q8v9-mcfg.json?$select=datetime,day,total,entries,exits&$where=datetime%20%3E=%20%272024-01-01T00:00:00%27&$order=datetime%20DESC&$limit=100

### Cambridge Fresh Pond usership (fresh-pond)
- Type: dataset; challenges: v3
- Portal use: How a shared outdoor place is actually used.
- Scope: Hourly use of the reservation from 2024 on.
- Starter snapshot: 8784 rows; columns: when, season, month, hour, average_users, blacks_nook, community_garden, little_fresh_pond, lusitania, pro_shop.
- Preview: 6 rows; 6 of 8,784 Fresh Pond hours from 2024 on.
- Direct source: https://data.cambridgema.gov/resource/6xy8-cstb.json?$select=datetime,season,month,hour,fp_avg_hrly_use,bn,cg,lfp,lus,pro_shop&$where=year%20%3E=%20%272024%27&$order=datetime%20DESC&$limit=100

### Somerville bicycle and pedestrian counts (somerville-counts)
- Type: dataset; challenges: v3
- Portal use: A campus-to-neighborhood walking or biking route.
- Scope: Bike and walk counts at named intersections.
- Starter snapshot: 2532 rows; columns: year, location, latitude, longitude, period, mode, count.
- Preview: 6 rows; 6 of 2,532 Somerville bike and walk counts.
- Direct source: https://data.somervillema.gov/resource/qu9x-4xq5.json?$select=year,location_name,latitude,longitude,am_pm,mode,count&$order=year%20DESC&$limit=100

### Boston Numina street sensors (numina)
- Type: dataset; challenges: v3
- Portal use: Who is using a shared street, hour by hour.
- Scope: Pedestrian and other street counts from the published sensors.
- Starter snapshot: 245555 rows; columns: zone, metric, object, count, time.
- Preview: 6 rows; 6 of 245,555 Numina sensor rows. Selected streets, 2020–2021.
- Direct source: https://data.boston.gov/api/3/action/datastore_search?resource_id=d6c06150-418d-4705-b0c9-e92afd23ede7&fields=zone_id,metric,objClass,result,time&limit=100

