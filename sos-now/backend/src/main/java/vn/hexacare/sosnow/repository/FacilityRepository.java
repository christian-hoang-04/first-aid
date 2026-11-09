package vn.hexacare.sosnow.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.hexacare.sosnow.model.Facility;
import java.time.Instant;
import java.util.List;

public interface FacilityRepository extends JpaRepository<Facility, String> {
    @Query("select distinct f from Facility f left join fetch f.phones where f.verifiedAt <= :now")
    List<Facility> findVerifiedWithPhones(@Param("now") Instant now);

    @Query("select distinct f.district from Facility f where f.verifiedAt <= :now order by f.district")
    List<String> findVerifiedDistrictNames(@Param("now") Instant now);
}
